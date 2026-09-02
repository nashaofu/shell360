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
import com.nashaofu.shell360.ffi.NativeEngineOutput
import com.nashaofu.shell360.ffi.NativeEngineOutputKind
import com.nashaofu.shell360.ffi.NativeJsbEngine
import java.util.concurrent.atomic.AtomicBoolean

class JsbPortBridge(
    private val webView: WebView,
    private val rustBridge: RustBridge,
    private val hostServices: PlatformHostServices,
) {
    private val callbackThread = HandlerThread("shell360-jsb").apply { start() }
    private val callbackHandler = Handler(callbackThread.looper)
    private val channels = mutableMapOf<String, WebMessagePortCompat>()
    private val disposed = AtomicBoolean()
    private val listenerOwner = Any()
    private val engine: NativeJsbEngine = rustBridge.createJsbEngine(hostServices)

    init {
        hostServices.attachCompletion { callId, resultJson ->
            dispatchOutputs {
                engine.completeHostCall(callId, resultJson)
            }
        }
        rustBridge.setEventListener(
            listenerOwner,
            { event ->
                dispatchOutputs { engine.emit(event) }
            },
            { clientId, shellId, data ->
                dispatchOutputs { engine.pushShellBinary(clientId, shellId, data) }
            },
        )
    }

    fun openChannel(channelId: String) {
        if (!disposed.get()) {
            executeOutputs(engine.onChannelOpen(channelId))
        }
    }

    fun closeChannel(channelId: String) {
        if (!disposed.get()) {
            executeOutputs(engine.onChannelClose(channelId))
        }
    }

    fun closeChannels() {
        channels.keys.toList().forEach { channelId ->
            executeOutputs(engine.onChannelClose(channelId))
        }
    }

    fun dispose() {
        if (!disposed.compareAndSet(false, true)) {
            return
        }
        hostServices.detachCompletion()
        rustBridge.clearEventListener(listenerOwner)
        channels.values.forEach(::closePort)
        channels.clear()
        engine.close()
        callbackThread.quitSafely()
    }

    private fun dispatchOutputs(operation: () -> List<NativeEngineOutput>) {
        if (disposed.get()) {
            return
        }
        val outputs = runCatching(operation).getOrElse { error ->
            Log.e(TAG, "Could not process JSB engine input", error)
            return
        }
        webView.post {
            if (!disposed.get()) {
                executeOutputs(outputs)
            }
        }
    }

    private fun executeOutputs(outputs: List<NativeEngineOutput>) {
        outputs.forEach(::executeOutput)
    }

    private fun executeOutput(output: NativeEngineOutput) {
        when (output.kind) {
            NativeEngineOutputKind.REPLY_TEXT -> writeText(
                checkNotNull(output.channelId),
                checkNotNull(output.text),
            )
            NativeEngineOutputKind.PUSH_BINARY -> writeBinary(
                checkNotNull(output.channelId),
                checkNotNull(output.bytes),
            )
            NativeEngineOutputKind.OPEN_CHANNEL -> openPort(
                checkNotNull(output.channelId),
                checkNotNull(output.text),
            )
            NativeEngineOutputKind.FAIL_CHANNEL -> postControl(checkNotNull(output.text))
            NativeEngineOutputKind.CLOSE_PORT -> closePort(checkNotNull(output.channelId))
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
                        val outputs = when (message?.type) {
                            WebMessageCompat.TYPE_STRING -> engine.onControlFrame(
                                channelId,
                                checkNotNull(message.data),
                            )
                            WebMessageCompat.TYPE_ARRAY_BUFFER -> engine.onBinaryFrame(
                                channelId,
                                checkNotNull(message.arrayBuffer),
                            )
                            else -> engine.onControlFrame(channelId, "")
                        }
                        webView.post {
                            if (!disposed.get() && channels[channelId] === nativePort) {
                                executeOutputs(outputs)
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
        executeOutputs(
            engine.onChannelOpenFailed(
                channelId,
                error.message ?: "Android WebView channel operation failed.",
            ),
        )
    }

    private fun writeText(channelId: String, text: String) {
        val port = channels[channelId] ?: return
        runCatching {
            port.postMessage(WebMessageCompat(text))
        }.onFailure { error ->
            Log.e(TAG, "Could not write JSB text frame", error)
            executeOutputs(engine.onChannelClose(channelId))
        }
    }

    private fun writeBinary(channelId: String, bytes: ByteArray) {
        val port = channels[channelId] ?: return
        runCatching {
            port.postMessage(WebMessageCompat(bytes))
        }.onFailure { error ->
            Log.e(TAG, "Could not write JSB binary frame", error)
            executeOutputs(engine.onChannelClose(channelId))
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
