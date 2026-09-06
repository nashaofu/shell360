package com.nashaofu.shell360.bridge

import android.content.Context
import com.nashaofu.shell360.ffi.HostServices
import com.nashaofu.shell360.ffi.JsbTransport
import com.nashaofu.shell360.ffi.NativeJsb
import com.nashaofu.shell360.ffi.Shell360Runtime

class RustBridge(context: Context) {
    private val runtime = Shell360Runtime(
        appDataDir = context.filesDir.resolve("shell360").absolutePath,
        cacheDir = context.cacheDir.resolve("shell360").absolutePath,
        appVersion = context.appVersionName(),
    )

    fun createJsb(transport: JsbTransport, hostServices: HostServices): NativeJsb {
        return NativeJsb(runtime, transport, hostServices)
    }

    fun shutdown() {
        runtime.shutdown()
    }
}

private fun Context.appVersionName(): String =
    runCatching {
        packageManager.getPackageInfo(packageName, 0).versionName
    }.getOrNull() ?: ""

class NativeBridgeException(
    val code: String,
    override val message: String,
    val details: Any? = null,
) : RuntimeException(message)
