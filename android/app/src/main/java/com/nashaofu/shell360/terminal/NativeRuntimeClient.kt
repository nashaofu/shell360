package com.nashaofu.shell360.terminal

import com.nashaofu.shell360.bridge.PlatformHostServices
import com.nashaofu.shell360.bridge.RustBridge
import com.nashaofu.shell360.ffi.NativeJsb
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import android.os.Handler
import android.os.Looper
import org.json.JSONObject

/** Small native client for the existing Rust runtime request protocol. */
class NativeRuntimeClient(
    rustBridge: RustBridge,
    hostServices: PlatformHostServices,
) {
    private val channelId = UUID.randomUUID().toString()
    private val callbacks = ConcurrentHashMap<String, (JSONObject) -> Unit>()
    private val binaryCallbacks = ConcurrentHashMap<String, (ByteArray) -> Unit>()
    private val openCallbacks = ConcurrentHashMap<String, () -> Unit>()
    private val eventCallbacks = ConcurrentHashMap<String, CopyOnWriteArrayList<(Any?) -> Unit>>()
    private val closed = AtomicBoolean()
    private val requestCount = AtomicLong()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val transport = NativeTerminalTransport(
        onBinary = { channel, bytes -> binaryCallbacks[channel]?.invoke(bytes) },
        onOpen = { channel ->
            mainHandler.post {
                if (!closed.get()) openCallbacks[channel]?.invoke()
            }
        },
        onText = { text -> handleResponse(text) },
    )
    private val jsb: NativeJsb = rustBridge.createJsb(transport, hostServices)

    fun open() {
        if (!closed.get()) jsb.openChannel(channelId)
    }

    fun request(
        method: String,
        data: JSONObject = JSONObject(),
        onResponse: (JSONObject) -> Unit,
    ): String {
        if (closed.get()) return ""
        val id = UUID.randomUUID().toString()
        callbacks[id] = { response -> mainHandler.post { if (!closed.get()) onResponse(response) } }
        requestCount.incrementAndGet()
        runCatching {
            jsb.receiveText(
                channelId,
                JSONObject().put("type", "invoke.request")
                    .put("id", id)
                    .put("method", method)
                    .put("data", data)
                    .toString(),
            )
        }.onFailure {
            callbacks.remove(id)
            throw it
        }
        return id
    }

    fun openChannel(channelId: String, onOpen: () -> Unit = {}, onBinary: (ByteArray) -> Unit = {}) {
        if (closed.get()) return
        openCallbacks[channelId] = onOpen
        binaryCallbacks[channelId] = onBinary
        jsb.openChannel(channelId)
    }

    fun requestOnChannel(
        channelId: String,
        method: String,
        data: JSONObject = JSONObject(),
        onResponse: (JSONObject) -> Unit = {},
    ): String {
        if (closed.get()) return ""
        val id = UUID.randomUUID().toString()
        callbacks[id] = { response -> mainHandler.post { if (!closed.get()) onResponse(response) } }
        requestCount.incrementAndGet()
        runCatching {
            jsb.receiveText(
                channelId,
                JSONObject().put("type", "invoke.request")
                    .put("id", id)
                    .put("method", method)
                    .put("data", data)
                    .toString(),
            )
        }.onFailure {
            callbacks.remove(id)
            throw it
        }
        return id
    }

    fun sendBinary(channelId: String, data: ByteArray) {
        if (!closed.get()) jsb.receiveBinary(channelId, data)
    }

    fun onEvent(event: String, targetId: String? = null, callback: (Any?) -> Unit): () -> Unit {
        val key = eventKey(event, targetId)
        eventCallbacks.computeIfAbsent(key) { CopyOnWriteArrayList() }.add(callback)
        return { eventCallbacks[key]?.remove(callback) }
    }

    fun closeChannel(channelId: String) {
        binaryCallbacks.remove(channelId)
        openCallbacks.remove(channelId)
        runCatching { jsb.closeChannel(channelId) }
    }

    fun close() {
        if (!closed.compareAndSet(false, true)) return
        mainHandler.removeCallbacksAndMessages(null)
        callbacks.clear()
        eventCallbacks.clear()
        binaryCallbacks.clear()
        openCallbacks.clear()
        runCatching { jsb.closeChannel(channelId) }
        runCatching { jsb.shutdown() }
        transport.dispose()
        jsb.close()
    }

    /** Number of requests submitted since this client was created. Useful for diagnostics and tests. */
    fun submittedRequestCount(): Long = requestCount.get()

    private fun handleResponse(text: String) {
        mainHandler.post {
            dispatchResponse(text)
        }
    }

    private fun dispatchResponse(text: String) {
        if (closed.get()) return
        val message = runCatching { JSONObject(text) }.getOrNull() ?: return
        when (message.optString("type")) {
            "invoke.response" -> {
                val id = message.optString("id")
                callbacks.remove(id)?.invoke(message)
            }
            "emit" -> {
                val event = message.optString("event")
                val targetId = message.optString("targetId").takeIf { it.isNotEmpty() }
                val payload = message.opt("payload").takeUnless { it == JSONObject.NULL }
                eventCallbacks[eventKey(event, targetId)]?.forEach { it(payload) }
                eventCallbacks[eventKey(event, null)]?.forEach { it(payload) }
            }
        }
    }

    private fun eventKey(event: String, targetId: String?): String = "$event\u0000${targetId ?: "*"}"
}
