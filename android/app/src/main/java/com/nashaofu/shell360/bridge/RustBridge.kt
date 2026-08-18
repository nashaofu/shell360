package com.nashaofu.shell360.bridge

import android.content.Context
import com.nashaofu.shell360.ffi.FfiEventSink
import com.nashaofu.shell360.ffi.FfiException
import com.nashaofu.shell360.ffi.Shell360Runtime
import org.json.JSONObject
import org.json.JSONTokener

class RustBridge(context: Context) {
    @Volatile
    private var eventListener: EventListener? = null

    private val runtime = Shell360Runtime(
        appDataDir = context.filesDir.resolve("shell360").absolutePath,
        cacheDir = context.cacheDir.resolve("shell360").absolutePath,
        eventSink = object : FfiEventSink {
            override fun onEvent(eventJson: String) {
                eventListener?.callback?.invoke(eventJson)
            }
        },
    )

    fun setEventListener(owner: Any, listener: (String) -> Unit) {
        eventListener = EventListener(owner, listener)
    }

    fun clearEventListener(owner: Any) {
        if (eventListener?.owner === owner) {
            eventListener = null
        }
    }

    fun healthCheck(): String {
        return runtime.healthCheck()
    }

    fun route(method: String, clientId: String, params: Any?): Any? {
        return try {
            JSONTokener(
                runtime.invoke(method, clientId, params.toJson()),
            ).nextValue()
        } catch (error: FfiException.UnsupportedMethod) {
            throw NativeBridgeException("BRIDGE_UNSUPPORTED", error.v1)
        } catch (error: FfiException.InvalidRequest) {
            throw NativeBridgeException("BRIDGE_INVALID_REQUEST", error.v1)
        } catch (error: FfiException.Keygen) {
            throw NativeBridgeException("KEYGEN_ERROR", error.v1)
        } catch (error: FfiException.Data) {
            throw NativeBridgeException(error.code, error.reason)
        } catch (error: FfiException.Ssh) {
            throw NativeBridgeException(
                error.code,
                error.reason,
                error.details?.let { JSONTokener(it).nextValue() },
            )
        }
    }

    fun invokeKeygen(params: Any?): JSONObject {
        return JSONObject(runtime.invokeKeygen(params.toJson()))
    }

    fun invokeData(method: String, params: Any?): Any? {
        return try {
            JSONTokener(runtime.invokeData(method, params.toJson())).nextValue()
        } catch (error: FfiException.Data) {
            throw NativeBridgeException(error.code, error.reason)
        } catch (error: FfiException.InvalidRequest) {
            throw NativeBridgeException("BRIDGE_INVALID_REQUEST", error.v1)
        }
    }

    fun invokeSsh(method: String, clientId: String, params: Any?): Any? {
        return try {
            JSONTokener(runtime.invokeSsh(method, clientId, params.toJson())).nextValue()
        } catch (error: FfiException.Ssh) {
            throw NativeBridgeException(
                error.code,
                error.reason,
                error.details?.let { JSONTokener(it).nextValue() },
            )
        } catch (error: FfiException.InvalidRequest) {
            throw NativeBridgeException("BRIDGE_INVALID_REQUEST", error.v1)
        }
    }

    fun releaseClient(clientId: String) {
        runtime.releaseClient(clientId)
    }

    fun shutdown() {
        runtime.shutdown()
    }

    private fun Any?.toJson(): String {
        return when (this) {
            is JSONObject -> toString()
            else -> JSONObject.wrap(this)?.toString() ?: "null"
        }
    }

    private data class EventListener(
        val owner: Any,
        val callback: (String) -> Unit,
    )
}

class NativeBridgeException(
    val code: String,
    override val message: String,
    val details: Any? = null,
) : RuntimeException(message)
