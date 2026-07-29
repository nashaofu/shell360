package com.nashaofu.shell360.bridge

import android.content.Context
import com.nashaofu.shell360.BuildConfig
import java.util.UUID

class BridgeRouter(
    context: Context,
    private val rustBridge: RustBridge,
    private val closeWindow: () -> Unit,
) {
    private val preferences = context.getSharedPreferences("shell360-platform", Context.MODE_PRIVATE)

    fun handle(message: String): String {
        var requestId: String? = null
        return try {
            val request = BridgeRequest.parse(message)
            requestId = request.id

            when (request.method) {
                "bridge.health" -> BridgeResponse.success(request.id, rustBridge.healthCheck())
                "bridge.releaseClient" -> {
                    rustBridge.releaseClient(request.clientId)
                    BridgeResponse.success(request.id, null)
                }
                "keygen.generate" -> {
                    BridgeResponse.success(request.id, rustBridge.invokeKeygen(request.params))
                }
                "app.getVersion" -> BridgeResponse.success(request.id, BuildConfig.VERSION_NAME)
                "machineUid.getMachineUid" -> {
                    BridgeResponse.success(request.id, getMachineUid())
                }
                "window.close" -> {
                    closeWindow()
                    BridgeResponse.success(request.id, null)
                }
                else -> BridgeResponse.error(
                    request.id,
                    "BRIDGE_UNSUPPORTED",
                    "${request.method} is not implemented by the P0 Android bridge.",
                )
            }
        } catch (error: Throwable) {
            BridgeResponse.error(
                requestId,
                "BRIDGE_NATIVE_ERROR",
                error.message ?: "Native bridge request failed.",
            )
        }
    }

    private fun getMachineUid(): String {
        preferences.getString(MACHINE_UID_KEY, null)?.let {
            return it
        }

        return UUID.randomUUID().toString().also {
            preferences.edit().putString(MACHINE_UID_KEY, it).apply()
        }
    }

    private companion object {
        const val MACHINE_UID_KEY = "machine_uid"
    }
}
