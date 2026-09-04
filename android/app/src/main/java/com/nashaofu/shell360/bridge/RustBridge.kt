package com.nashaofu.shell360.bridge

import android.content.Context
import com.nashaofu.shell360.ffi.FfiEventSink
import com.nashaofu.shell360.ffi.HostServices
import com.nashaofu.shell360.ffi.JsbTransport
import com.nashaofu.shell360.ffi.NativeJsb
import com.nashaofu.shell360.ffi.Shell360Runtime

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

            override fun onSshShellData(clientId: String, sshShellId: String, data: ByteArray) {
                eventListener?.binaryCallback?.invoke(clientId, sshShellId, data)
            }
        },
    )

    fun setEventListener(owner: Any, listener: (String) -> Unit, binaryListener: (String, String, ByteArray) -> Unit = { _, _, _ -> }) {
        eventListener = EventListener(owner, listener, binaryListener)
    }

    fun clearEventListener(owner: Any) {
        if (eventListener?.owner === owner) {
            eventListener = null
        }
    }

    fun createJsb(transport: JsbTransport, hostServices: HostServices): NativeJsb {
        return NativeJsb(runtime, transport, hostServices)
    }

    fun shutdown() {
        runtime.shutdown()
    }

    private data class EventListener(
        val owner: Any,
        val callback: (String) -> Unit,
        val binaryCallback: (String, String, ByteArray) -> Unit,
    )
}

class NativeBridgeException(
    val code: String,
    override val message: String,
    val details: Any? = null,
) : RuntimeException(message)
