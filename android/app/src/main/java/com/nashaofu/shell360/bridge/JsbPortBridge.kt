package com.nashaofu.shell360.bridge

import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.webkit.WebView
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebMessagePortCompat
import androidx.webkit.WebViewCompat
import com.nashaofu.shell360.BuildConfig
import com.nashaofu.shell360.ffi.JsbTransport
import com.nashaofu.shell360.ffi.NativeJsb
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Bridges the Rust JSB core with Android WebMessagePorts.
 *
 * Inbound (JS -> Rust): [AndroidJsbInterface] and the port callbacks enter
 * Rust through [NativeJsb]; port messages arrive on [callbackThread] and are
 * hopped to the WebView (main) thread before the Rust call, so JSB entries are
 * serialized with outbound transport callbacks.
 *
 * Outbound (Rust -> JS): the [JsbTransport] callbacks are invoked on Rust
 * worker threads and every one hops to the main thread via [WebView.post],
 * which keeps per-channel frame ordering stable. Port failures are recovered
 * by telling Rust the channel closed; Rust never interprets output lists.
 */
class JsbPortBridge(
    private val webView: WebView,
    private val rustBridge: RustBridge,
    private val hostServices: PlatformHostServices,
) : JsbTransport {
    private val callbackThread = HandlerThread("shell360-jsb").apply { start() }
    private val callbackHandler = Handler(callbackThread.looper)
    private val channels = mutableMapOf<String, WebMessagePortCompat>()
    private val disposed = AtomicBoolean()
    private val listenerOwner = Any()
    private val jsb: NativeJsb = rustBridge.createJsb(this, hostServices)

    init {
        hostServices.attachCompletion { callId, resultJson ->
            runRust { jsb.completeHostCall(callId, resultJson) }
        }
        rustBridge.setEventListener(
            listenerOwner,
            { event ->
                runRust { jsb.emit(event) }
            },
            { clientId, shellId, data ->
                runRust { jsb.pushShellBinary(clientId, shellId, data) }
            },
        )
    }

    fun openChannel(channelId: String) {
        runRust { jsb.openChannel(channelId) }
    }

    fun closeChannel(channelId: String) {
        runRust { jsb.closeChannel(channelId) }
    }

    fun closeChannels() {
        channels.keys.toList().forEach { channelId ->
            runRust { jsb.closeChannel(channelId) }
        }
    }

    fun emitBackPress() {
        runRust {
            jsb.emit(
                """{"type":"emit","event":"app.back","targetId":null,"payload":{}}""",
            )
        }
    }

    fun dispose() {
        if (!disposed.compareAndSet(false, true)) {
            return
        }
        hostServices.detachCompletion()
        rustBridge.clearEventListener(listenerOwner)
        runRust { jsb.shutdown() }
        channels.values.forEach(::closePort)
        channels.clear()
        jsb.close()
        callbackThread.quitSafely()
    }

    // --- JsbTransport: Rust -> WebView. Invoked on Rust threads; hop to main. ---

    override fun openChannel(channelId: String, controlMessage: String) {
        webView.post {
            if (!disposed.get()) {
                openPort(channelId, controlMessage)
            }
        }
    }

    override fun failChannel(channelId: String, controlMessage: String) {
        webView.post {
            if (!disposed.get()) {
                postControl(controlMessage)
            }
        }
    }

    override fun sendText(channelId: String, message: String) {
        webView.post {
            if (!disposed.get()) {
                writeText(channelId, message)
            }
        }
    }

    override fun sendBinary(channelId: String, data: ByteArray) {
        webView.post {
            if (!disposed.get()) {
                writeBinary(channelId, data)
            }
        }
    }

    override fun closeChannel(channelId: String) {
        webView.post {
            closePort(channelId)
        }
    }

    private fun runRust(action: () -> Unit) {
        if (disposed.get()) {
            return
        }
        runCatching(action).onFailure { error ->
            Log.e(TAG, "JSB native call failed", error)
        }
    }

    private fun openPort(channelId: String, controlText: String) {
        val ports = try {
            WebViewCompat.createWebMessageChannel(webView)
        } catch (error: Exception) {
            reportOpenFailure(channelId, error)
            return
        }
        if (ports.size != 2) {
            ports.forEach(::closePort)
            reportOpenFailure(
                channelId,
                IllegalStateException("Android WebView did not create a message port pair."),
            )
            return
        }

        val nativePort = ports[0]
        val webPort = ports[1]
        try {
            nativePort.setWebMessageCallback(
                callbackHandler,
                object : WebMessagePortCompat.WebMessageCallbackCompat() {
                    override fun onMessage(
                        port: WebMessagePortCompat,
                        message: WebMessageCompat?,
                    ) {
                        val type = message?.type
                        val text = message?.data
                        val bytes = message?.arrayBuffer
                        webView.post {
                            if (disposed.get() || channels[channelId] !== nativePort) {
                                return@post
                            }
                            when (type) {
                                WebMessageCompat.TYPE_STRING ->
                                    runRust { jsb.receiveText(channelId, text.orEmpty()) }
                                WebMessageCompat.TYPE_ARRAY_BUFFER ->
                                    if (bytes != null) {
                                        runRust { jsb.receiveBinary(channelId, bytes) }
                                    }
                                else -> runRust { jsb.receiveText(channelId, "") }
                            }
                        }
                    }
                },
            )
            channels[channelId] = nativePort
            WebViewCompat.postWebMessage(
                webView,
                WebMessageCompat(controlText, arrayOf(webPort)),
                Uri.parse(BuildConfig.WEBVIEW_ORIGIN),
            )
        } catch (error: Exception) {
            channels.remove(channelId)
            ports.forEach(::closePort)
            reportOpenFailure(channelId, error)
        }
    }

    private fun reportOpenFailure(channelId: String, error: Exception) {
        runRust {
            jsb.channelOpenFailed(
                channelId,
                error.message ?: "Android WebView channel operation failed.",
            )
        }
    }

    private fun writeText(channelId: String, text: String) {
        val port = channels[channelId] ?: return
        runCatching {
            port.postMessage(WebMessageCompat(text))
        }.onFailure { error ->
            Log.e(TAG, "Could not write JSB text frame", error)
            runRust { jsb.closeChannel(channelId) }
        }
    }

    private fun writeBinary(channelId: String, bytes: ByteArray) {
        val port = channels[channelId] ?: return
        runCatching {
            port.postMessage(WebMessageCompat(bytes))
        }.onFailure { error ->
            Log.e(TAG, "Could not write JSB binary frame", error)
            runRust { jsb.closeChannel(channelId) }
        }
    }

    private fun postControl(text: String) {
        runCatching {
            WebViewCompat.postWebMessage(
                webView,
                WebMessageCompat(text),
                Uri.parse(BuildConfig.WEBVIEW_ORIGIN),
            )
        }.onFailure { error ->
            Log.e(TAG, "Could not post JSB control frame", error)
        }
    }

    private fun closePort(channelId: String) {
        channels.remove(channelId)?.let(::closePort)
    }

    private fun closePort(port: WebMessagePortCompat) {
        runCatching(port::close).onFailure { error ->
            Log.w(TAG, "Could not close JSB message port", error)
        }
    }

    private companion object {
        const val TAG = "Shell360Jsb"
    }
}
