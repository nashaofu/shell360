package com.nashaofu.shell360.terminal

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.nashaofu.shell360.Shell360Application
import com.nashaofu.shell360.bridge.PlatformHostServices

/** Keeps the Rust runtime alive while an Activity is recreated for configuration changes. */
class NativeRuntimeViewModel(application: Application) : AndroidViewModel(application) {
    private val rustBridge = (application as Shell360Application).rustBridge
    private var hostServices: PlatformHostServices? = null
    private var client: NativeRuntimeClient? = null

    fun bind(bindings: PlatformHostServices): NativeRuntimeClient {
        val existingServices = hostServices
        if (existingServices != null) {
            existingServices.adopt(bindings)
            return checkNotNull(client)
        }
        hostServices = bindings
        return NativeRuntimeClient(rustBridge, bindings).also {
            it.open()
            client = it
        }
    }

    override fun onCleared() {
        client?.close()
        client = null
        hostServices = null
        super.onCleared()
    }
}
