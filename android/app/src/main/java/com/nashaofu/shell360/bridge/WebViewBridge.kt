package com.nashaofu.shell360.bridge

import android.webkit.WebView
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebMessagePortCompat
import androidx.webkit.WebViewCompat
import java.util.concurrent.atomic.AtomicBoolean

class WebViewBridge(
    private val webView: WebView,
    private val router: BridgeRouter,
    private val rustBridge: RustBridge,
) {
    @Volatile
    private var messagePort: WebMessagePortCompat? = null

    private val callbackHandler = Handler(Looper.getMainLooper())
    private val disposed = AtomicBoolean()
    private val listenerOwner = Any()

    init {
        rustBridge.setEventListener(listenerOwner) { event ->
            webView.post {
                if (!disposed.get()) {
                    messagePort?.postMessage(WebMessageCompat(event))
                }
            }
        }
    }

    fun attach() {
        if (disposed.get()) {
            return
        }

        messagePort?.close()
        messagePort = null

        val ports = WebViewCompat.createWebMessageChannel(webView)
        val nativePort = ports[0]
        messagePort = nativePort
        nativePort.setWebMessageCallback(callbackHandler, object : WebMessagePortCompat.WebMessageCallbackCompat() {
            override fun onMessage(port: WebMessagePortCompat, message: WebMessageCompat?) {
                val body = message?.data ?: run {
                    port.postMessage(WebMessageCompat(
                        BridgeResponse.error(
                            null,
                            "BRIDGE_INVALID_MESSAGE",
                            "Native bridge messages must contain text data.",
                        ),
                    ))
                    return
                }
                if (body.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_SIZE) {
                    port.postMessage(WebMessageCompat(
                        BridgeResponse.error(
                            null,
                            "BRIDGE_MESSAGE_TOO_LARGE",
                            "Native bridge messages are limited to $MAX_MESSAGE_SIZE bytes.",
                        ),
                    ))
                    return
                }
                val response = router.handle(body)
                webView.post {
                    if (!disposed.get()) {
                        port.postMessage(WebMessageCompat(response))
                    }
                }
            }
        })
        WebViewCompat.postWebMessage(
            webView,
            WebMessageCompat(PORT_MESSAGE, arrayOf(ports[1])),
            Uri.parse(com.nashaofu.shell360.BuildConfig.WEBVIEW_ORIGIN),
        )
    }

    fun dispose() {
        if (!disposed.compareAndSet(false, true)) {
            return
        }

        rustBridge.clearEventListener(listenerOwner)
        messagePort?.close()
        messagePort = null
    }

    private companion object {
        const val PORT_MESSAGE = "shell360:port"
        const val MAX_MESSAGE_SIZE = 1024 * 1024
    }
}
