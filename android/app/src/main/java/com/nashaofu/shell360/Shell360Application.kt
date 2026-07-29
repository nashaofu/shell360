package com.nashaofu.shell360

import android.app.Application
import com.nashaofu.shell360.bridge.RustBridge

class Shell360Application : Application() {
    val rustBridge: RustBridge by lazy {
        RustBridge(this)
    }
}
