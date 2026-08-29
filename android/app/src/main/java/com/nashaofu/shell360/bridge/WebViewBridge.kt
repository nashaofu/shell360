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
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

class WebViewBridge(
    private val webView: WebView,
    private val jsb: Jsb,
    private val rustBridge: RustBridge,
) {
    private val callbackThread = HandlerThread("shell360-jsb").apply { start() }
    private val callbackHandler = Handler(callbackThread.looper)
    private val channels = mutableMapOf<String, WebMessagePortCompat>()
    private val disposed = AtomicBoolean()
    private val listenerOwner = Any()

    init {
        rustBridge.setEventListener(listenerOwner) { event ->
            webView.post {
                if (disposed.get()) {
                    return@post
                }

                val iterator = channels.iterator()
                while (iterator.hasNext()) {
                    val (_, port) = iterator.next()
                    try {
                        port.postMessage(WebMessageCompat(event))
                    } catch (error: Exception) {
                        Log.e(TAG, "Could not emit a JSB event", error)
                        closePort(port)
                        iterator.remove()
                    }
                }
                closeConnectionIfUnused()
            }
        }
    }

    fun openChannel(channelId: String) {
        if (disposed.get()) {
            return
        }
        if (!isValidChannelId(channelId)) {
            postChannelFailure(
                channelId,
                "JSB_CHANNEL_INVALID_ID",
                "JSB channel ID must be a UUID.",
            )
            return
        }

        closeChannel(channelId)
        val ports = try {
            WebViewCompat.createWebMessageChannel(webView)
        } catch (error: Exception) {
            postChannelFailure(
                channelId,
                "JSB_CHANNEL_OPEN_FAILED",
                error.message ?: "Could not create Android message channel.",
            )
            return
        }
        if (ports.size != 2) {
            ports.forEach(::closePort)
            postChannelFailure(
                channelId,
                "JSB_CHANNEL_OPEN_FAILED",
                "Android WebView did not create a message port pair.",
            )
            return
        }

        val nativePort = ports[0]
        val webPort = ports[1]
        if (channels.isEmpty()) {
            callbackHandler.post {
                jsb.connect()?.let(rustBridge::releaseClient)
            }
        }

        try {
            nativePort.setWebMessageCallback(
                callbackHandler,
                object : WebMessagePortCompat.WebMessageCallbackCompat() {
                    override fun onMessage(
                        port: WebMessagePortCompat,
                        message: WebMessageCompat?,
                    ) {
                        val body = message
                            ?.takeIf { it.type == WebMessageCompat.TYPE_STRING }
                            ?.data
                        val response = when {
                            body == null -> BridgeResponse.error(
                                null,
                                "JSB_INVALID_MESSAGE",
                                "JSB requests must contain text data.",
                            )
                            body.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_SIZE -> {
                                BridgeResponse.error(
                                    requestId(body),
                                    "JSB_MESSAGE_TOO_LARGE",
                                    "JSB requests are limited to $MAX_MESSAGE_SIZE bytes.",
                                )
                            }
                            else -> runCatching { jsb.dispatch(body) }.getOrElse { error ->
                                BridgeResponse.error(
                                    requestId(body),
                                    "JSB_NATIVE_ERROR",
                                    error.message ?: "Android JSB dispatch failed.",
                                )
                            }
                        }

                        webView.post {
                            if (!disposed.get() && channels[channelId] === port) {
                                try {
                                    port.postMessage(WebMessageCompat(response))
                                } catch (error: Exception) {
                                    Log.e(TAG, "Could not send a JSB response", error)
                                    closeChannel(channelId)
                                }
                            }
                        }
                    }
                },
            )
        } catch (error: Exception) {
            ports.forEach(::closePort)
            closeConnectionIfUnused()
            postChannelFailure(
                channelId,
                "JSB_CHANNEL_OPEN_FAILED",
                error.message ?: "Could not listen to Android message channel.",
            )
            return
        }

        channels[channelId] = nativePort
        try {
            postControlMessage("channel.opened", channelId, webPort)
        } catch (error: Exception) {
            channels.remove(channelId)
            ports.forEach(::closePort)
            closeConnectionIfUnused()
            postChannelFailure(
                channelId,
                "JSB_CHANNEL_OPEN_FAILED",
                error.message ?: "Could not transfer Android message channel.",
            )
        }
    }

    fun closeChannel(channelId: String) {
        channels.remove(channelId)?.let(::closePort)
        closeConnectionIfUnused()
    }

    fun closeChannels() {
        channels.values.forEach(::closePort)
        channels.clear()
        closeConnectionIfUnused()
    }

    fun dispose() {
        if (!disposed.compareAndSet(false, true)) {
            return
        }

        rustBridge.clearEventListener(listenerOwner)
        closeChannels()
        callbackThread.quitSafely()
    }

    private fun closeConnectionIfUnused() {
        if (channels.isEmpty()) {
            callbackHandler.post {
                jsb.close()?.let(rustBridge::releaseClient)
            }
        }
    }

    private fun postChannelFailure(channelId: String, code: String, message: String) {
        try {
            WebViewCompat.postWebMessage(
                webView,
                WebMessageCompat(
                    JSONObject()
                        .put("source", CONTROL_MESSAGE_SOURCE)
                        .put("type", "channel.open.failed")
                        .put("channelId", channelId)
                        .put(
                            "error",
                            JSONObject()
                                .put("code", code)
                                .put("message", message),
                        )
                        .toString(),
                ),
                Uri.parse(BuildConfig.WEBVIEW_ORIGIN),
            )
        } catch (error: Exception) {
            Log.e(TAG, "Could not report JSB channel failure", error)
        }
    }

    private fun postControlMessage(
        type: String,
        channelId: String,
        port: WebMessagePortCompat,
    ) {
        WebViewCompat.postWebMessage(
            webView,
            WebMessageCompat(
                JSONObject()
                    .put("source", CONTROL_MESSAGE_SOURCE)
                    .put("type", type)
                    .put("channelId", channelId)
                    .toString(),
                arrayOf(port),
            ),
            Uri.parse(BuildConfig.WEBVIEW_ORIGIN),
        )
    }

    private fun closePort(port: WebMessagePortCompat) {
        runCatching(port::close).onFailure { error ->
            Log.w(TAG, "Could not close JSB message port", error)
        }
    }

    private fun isValidChannelId(channelId: String): Boolean {
        return runCatching { UUID.fromString(channelId) }.isSuccess
    }

    private fun requestId(message: String): String? {
        return runCatching { JSONObject(message).optString("id") }
            .getOrNull()
            ?.takeIf(String::isNotBlank)
    }

    private companion object {
        const val TAG = "Shell360Jsb"
        const val CONTROL_MESSAGE_SOURCE = "shell360.jsb"
        const val MAX_MESSAGE_SIZE = 1024 * 1024
    }
}
