package com.nashaofu.shell360.core.runtime

import android.content.ClipboardManager
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.ActivityNotFoundException
import android.util.Log
import com.nashaofu.shell360.ffi.HostServices
import com.nashaofu.shell360.ffi.JsbTransport
import com.nashaofu.shell360.ffi.NativeJsb
import com.nashaofu.shell360.ffi.Shell360Runtime
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

/** In-process JSB client used by Compose screens and the native SSH runtime. */
class NativeRuntimeClient(context: Context) : AutoCloseable {
    private val appContext = context.applicationContext
    private val appData = File(appContext.filesDir, "shell360").apply { mkdirs() }
    private val cache = File(appContext.cacheDir, "shell360").apply { mkdirs() }
    private val staging = File(cache, "bridge").apply { mkdirs() }
    private val controlChannel = UUID.randomUUID().toString()
    val clientId: String = controlChannel
    private val pending = ConcurrentHashMap<String, CompletableDeferred<JSONObject>>()
    private val binaryListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(ByteArray) -> Unit>>()
    private val binaryChannelIds = ConcurrentHashMap.newKeySet<String>()
    private val eventListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(JSONObject) -> Unit>>()
    private val hostCallExecutor = Executors.newCachedThreadPool()
    private val transport = RuntimeTransport()
    private val hostServices = RuntimeHostServices()
    private val runtime = Shell360Runtime(appData.absolutePath, cache.absolutePath, appContext.packageName)
    private val jsb = NativeJsb(runtime, transport, hostServices)

    init {
        jsb.configureLimits(65_536uL, 1_048_576uL)
        jsb.openChannel(controlChannel)
    }

    suspend fun invoke(method: String, data: JSONObject = JSONObject()): JSONObject = withContext(Dispatchers.IO) {
        val id = UUID.randomUUID().toString()
        val response = CompletableDeferred<JSONObject>()
        pending[id] = response
        try {
            val request = JSONObject()
                .put("type", "invoke.request")
                .put("id", id)
                .put("clientId", clientId)
                .put("method", method)
                .put("data", data)
            jsb.receiveText(controlChannel, request.toString())
            response.await()
        } finally {
            pending.remove(id)
        }
    }

    fun openBinaryChannel(channelId: String, listener: (ByteArray) -> Unit) {
        binaryListeners.computeIfAbsent(channelId) { CopyOnWriteArrayList() }.add(listener)
        if (binaryChannelIds.add(channelId)) jsb.openChannel(channelId)
    }

    fun closeBinaryChannel(channelId: String) {
        binaryListeners.remove(channelId)
        binaryChannelIds.remove(channelId)
        runCatching { jsb.closeChannel(channelId) }
    }

    fun onEvent(name: String, listener: (JSONObject) -> Unit) {
        eventListeners.computeIfAbsent(name) { CopyOnWriteArrayList() }.add(listener)
    }

    fun sendBinary(channelId: String, data: ByteArray) {
        jsb.receiveBinary(channelId, data)
    }

    override fun close() {
        pending.values.forEach { it.cancel() }
        pending.clear()
        binaryListeners.clear()
        binaryChannelIds.clear()
        eventListeners.clear()
        hostCallExecutor.shutdownNow()
        runCatching { jsb.shutdown() }
        jsb.close()
        runCatching { runtime.releaseClient(clientId) }
        runtime.shutdown()
        runtime.close()
    }

    private inner class RuntimeTransport : JsbTransport {
        override fun openChannel(channelId: String, controlMessage: String) = Unit

        override fun failChannel(channelId: String, controlMessage: String) {
            dispatchText(channelId, controlMessage)
        }

        override fun sendText(channelId: String, message: String) {
            dispatchText(channelId, message)
        }

        override fun sendBinary(channelId: String, data: ByteArray) {
            binaryListeners[channelId]?.forEach { listener -> listener(data) }
        }

        override fun closeChannel(channelId: String) = Unit
    }

    private fun dispatchText(channelId: String, message: String) {
        val json = runCatching { JSONObject(message) }.getOrNull() ?: return
        if (json.optString("type") == "invoke.response") {
            val id = json.optString("id")
            val error = json.optJSONObject("error")
            val completion = pending[id] ?: return
            if (error != null) {
                completion.completeExceptionally(
                    NativeRuntimeException(error.optString("code"), error.optString("message"), error.optJSONObject("details")),
                )
        } else {
            completion.complete(json.optJSONObject("data") ?: JSONObject().put("value", json.opt("data")))
            }
        } else if (json.optString("type") == "emit") {
            eventListeners[json.optString("event")]?.forEach { it(json.optJSONObject("payload") ?: JSONObject()) }
        } else if (json.optString("type") == "channel.close" || json.optString("type") == "channel.error") {
            if (binaryChannelIds.remove(channelId)) {
                binaryListeners.remove(channelId)?.forEach { listener ->
                    listener(ByteArray(0))
                }
            }
        }
    }

    private inner class RuntimeHostServices : HostServices {
        override fun onHostCall(callId: String, primitive: String, paramsJson: String) {
            hostCallExecutor.execute { handleHostCall(callId, primitive, paramsJson) }
        }

        private fun handleHostCall(callId: String, primitive: String, paramsJson: String) {
            val params = runCatching { JSONObject(paramsJson) }.getOrElse { JSONObject() }
            try {
                val result = when (primitive) {
                    "readTextFile" -> readText(params)
                    "writeTextFile" -> writeText(params)
                    "readScopedFile" -> readScopedFile(params)
                    "writeScopedFile" -> writeScopedFile(params)
                    "readClipboard" -> readClipboard()
                    "writeClipboard" -> writeClipboard(params)
                    "openExternal" -> openExternal(params)
                    "setSystemBarsAppearance", "backToBackground", "closeWindow" -> null
                    "pickDocuments", "saveDocument" -> throw UnsupportedOperationException("Use the Android document picker for this operation.")
                    else -> throw UnsupportedOperationException("Unsupported Android host operation: $primitive")
                }
                jsb.completeHostCall(callId, JSONObject().put("data", result).toString())
            } catch (error: Exception) {
                Log.e("Shell360Runtime", "Host operation failed: $primitive", error)
                val reason = error.message ?: "The Android host operation failed."
                jsb.completeHostCall(
                    callId,
                    JSONObject().put("error", JSONObject().put("code", "BRIDGE_NATIVE_ERROR").put("message", reason)).toString(),
                )
            }
        }

        private fun readText(params: JSONObject): Any = resolvePath(params).readText()

        private fun writeText(params: JSONObject): Any? {
            val file = resolvePath(params)
            file.parentFile?.mkdirs()
            file.writeText(params.optString("contents"))
            return null
        }

        private fun readClipboard(): String =
            (appContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                .primaryClip?.getItemAt(0)?.coerceToText(appContext)?.toString().orEmpty()

        private fun writeClipboard(params: JSONObject): Any? {
            val clip = ClipData.newPlainText("Shell360", params.optString("text"))
            (appContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(clip)
            return null
        }

        private fun openExternal(params: JSONObject): Any? {
            val uri = Uri.parse(params.getString("url"))
            require(uri.scheme in setOf("http", "https", "mailto", "tel")) { "External URL scheme is not allowed." }
            try {
                appContext.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (error: ActivityNotFoundException) {
                throw IllegalStateException("No application can open this link.", error)
            }
            return null
        }

        private fun readScopedFile(params: JSONObject): Any? {
            val uri = Uri.parse(params.optString("source").ifEmpty { params.optString("uri") })
            val destination = File(staging, UUID.randomUUID().toString())
            destination.parentFile?.mkdirs()
            appContext.contentResolver.openInputStream(uri).use { input ->
                requireNotNull(input) { "Could not open selected document." }.copyTo(destination.outputStream())
            }
            return null
        }

        private fun writeScopedFile(params: JSONObject): Any? {
            val source = File(params.getString("sourcePath"))
            val uri = Uri.parse(params.optString("target").ifEmpty { params.optString("uri") })
            appContext.contentResolver.openOutputStream(uri).use { output ->
                requireNotNull(output) { "Could not open destination document." }.use { source.inputStream().use { input -> input.copyTo(it) } }
            }
            return null
        }

        private fun resolvePath(params: JSONObject): File {
            val path = params.optString("path", params.optString("filename"))
            if (path.isEmpty()) error("A file path is required.")
            if (path.startsWith("file://")) return File(Uri.parse(path).path ?: error("Invalid file URL"))
            when (params.optString("baseDir")) {
                "cache" -> return File(cache, path).canonicalFile.also { require(it.toPath().startsWith(cache.canonicalFile.toPath())) }
                "appLocalData" -> Unit
                else -> return File(path)
            }
            val root = appData.canonicalFile
            val candidate = File(root, path).canonicalFile
            require(candidate.toPath().startsWith(root.toPath())) { "Path is outside app-local storage." }
            return candidate
        }
    }
}

class NativeRuntimeException(val code: String, override val message: String, val details: JSONObject?) : Exception(message)
