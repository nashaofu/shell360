package com.nashaofu.shell360.bridge

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

class AndroidJsbInterface {
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var bridge: JsbPortBridge? = null

    fun attach(bridge: JsbPortBridge) {
        this.bridge = bridge
    }

    fun detach() {
        bridge = null
    }

    @JavascriptInterface
    fun openChannel(channelId: String) {
        mainHandler.post {
            bridge?.openChannel(channelId)
        }
    }

    @JavascriptInterface
    fun closeChannel(channelId: String) {
        mainHandler.post {
            bridge?.closeChannel(channelId)
        }
    }
}
