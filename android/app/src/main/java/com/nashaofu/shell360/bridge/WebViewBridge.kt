package com.nashaofu.shell360.bridge

import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class WebViewBridge(
    private val webView: WebView,
    private val router: BridgeRouter,
    private val rustBridge: RustBridge,
) {
    @Volatile
    private var replyProxy: JavaScriptReplyProxy? = null

    private val executor = Executors.newSingleThreadExecutor()
    private val disposed = AtomicBoolean()
    private val listenerOwner = Any()

    init {
        WebViewCompat.addWebMessageListener(
            webView,
            JS_OBJECT_NAME,
            setOf(com.nashaofu.shell360.BuildConfig.WEBVIEW_ORIGIN),
        ) { _, message, _, isMainFrame, proxy ->
            if (!isMainFrame || disposed.get()) {
                return@addWebMessageListener
            }

            replyProxy = proxy
            val body = message.data ?: run {
                proxy.postMessage(
                    BridgeResponse.error(
                        null,
                        "BRIDGE_INVALID_MESSAGE",
                        "Native bridge messages must contain text data.",
                    ),
                )
                return@addWebMessageListener
            }
            if (body.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_SIZE) {
                proxy.postMessage(
                    BridgeResponse.error(
                        null,
                        "BRIDGE_MESSAGE_TOO_LARGE",
                        "Native bridge messages are limited to $MAX_MESSAGE_SIZE bytes.",
                    ),
                )
                return@addWebMessageListener
            }

            executor.execute {
                val response = router.handle(body)
                webView.post {
                    if (!disposed.get()) {
                        proxy.postMessage(response)
                    }
                }
            }
        }

        rustBridge.setEventListener(listenerOwner) { event ->
            webView.post {
                if (!disposed.get()) {
                    replyProxy?.postMessage(event)
                }
            }
        }
    }

    fun dispose() {
        if (!disposed.compareAndSet(false, true)) {
            return
        }

        WebViewCompat.removeWebMessageListener(webView, JS_OBJECT_NAME)
        rustBridge.clearEventListener(listenerOwner)
        replyProxy = null
        executor.shutdown()
    }

    private companion object {
        const val JS_OBJECT_NAME = "shell360Native"
        const val MAX_MESSAGE_SIZE = 1024 * 1024
    }
}
