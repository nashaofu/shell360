package com.nashaofu.shell360.bridge

import android.content.Context
import com.nashaofu.shell360.ffi.FfiEventSink
import com.nashaofu.shell360.ffi.Shell360Runtime
import org.json.JSONObject

class RustBridge(context: Context) {
    @Volatile
    private var eventListener: ((String) -> Unit)? = null

    private val runtime = Shell360Runtime(
        appDataDir = context.filesDir.resolve("shell360").absolutePath,
        cacheDir = context.cacheDir.resolve("shell360").absolutePath,
        eventSink = object : FfiEventSink {
            override fun onEvent(eventJson: String) {
                eventListener?.invoke(eventJson)
            }
        },
    )

    fun setEventListener(listener: ((String) -> Unit)?) {
        eventListener = listener
    }

    fun healthCheck(): String {
        return runtime.healthCheck()
    }

    fun invokeKeygen(params: Any?): JSONObject {
        val paramsJson = when (params) {
            is JSONObject -> params.toString()
            else -> JSONObject.wrap(params)?.toString() ?: "null"
        }
        return JSONObject(runtime.invokeKeygen(paramsJson))
    }

    fun releaseClient(clientId: String) {
        runtime.releaseClient(clientId)
    }

    fun shutdown() {
        runtime.shutdown()
    }
}
