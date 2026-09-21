package com.nashaofu.shell360.terminal

import android.os.Handler
import android.os.Looper
import com.nashaofu.shell360.ffi.JsbTransport
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Transport for a native terminal surface.
 *
 * It deliberately keeps terminal bytes as byte arrays. The JSB protocol is
 * still used for the control plane during the migration, while the terminal
 * view receives output through [onBinary] and sends input through the session.
 */
class NativeTerminalTransport(
    private val onBinary: (String, ByteArray) -> Unit,
    private val onControl: (String) -> Unit = {},
    private val onText: (String) -> Unit = {},
    private val onOpen: (String) -> Unit = {},
) : JsbTransport {
    private val main = Handler(Looper.getMainLooper())
    private val disposed = AtomicBoolean()

    override fun openChannel(channelId: String, controlMessage: String) {
        if (!disposed.get()) main.post {
            onOpen(channelId)
            onControl(controlMessage)
        }
    }

    override fun failChannel(channelId: String, controlMessage: String) {
        if (!disposed.get()) main.post { onControl(controlMessage) }
    }

    override fun sendText(channelId: String, message: String) {
        if (!disposed.get()) main.post { onText(message) }
    }

    override fun sendBinary(channelId: String, data: ByteArray) {
        if (!disposed.get()) main.post { onBinary(channelId, data.copyOf()) }
    }

    override fun closeChannel(channelId: String) = Unit

    fun dispose() {
        if (disposed.compareAndSet(false, true)) main.removeCallbacksAndMessages(null)
    }
}
