package com.nashaofu.shell360.terminal

import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import android.util.Log
import org.json.JSONObject

/** Native terminal control/data-plane boundary used by the future Termux view. */
class NativeTerminalSession(
    private val runtime: NativeRuntimeClient,
    onOutput: (ByteArray) -> Unit = {},
    private val onClose: () -> Unit = {},
) {
    private var output: (ByteArray) -> Unit = onOutput
    private val channelId = UUID.randomUUID().toString()
    private val dataChannelId = UUID.randomUUID().toString()
    private val shellId = UUID.randomUUID().toString()
    private val closed = AtomicBoolean()
    private val opened = AtomicBoolean()
    private val readyChannels = mutableSetOf<String>()
    private var pendingOpen: (() -> Unit)? = null
    private var removeEofListener: (() -> Unit)? = null
    private var removeCloseListener: (() -> Unit)? = null
    fun open() {
        if (!closed.get() && opened.compareAndSet(false, true)) {
            removeEofListener = runtime.onEvent("ssh.shell.eof", shellId) { handleRemoteClose() }
            removeCloseListener = runtime.onEvent("ssh.shell.close", shellId) { handleRemoteClose() }
            runtime.openChannel(channelId, onOpen = { channelOpened(channelId) })
            runtime.openChannel(dataChannelId, onOpen = { channelOpened(dataChannelId) }, onBinary = { output(it) })
        }
    }

    fun setOnOutput(callback: (ByteArray) -> Unit) { output = callback }

    fun openShell(sessionId: String, columns: Int, rows: Int, terminalType: String = "xterm-256color", startupCommand: String = "", envs: Map<String, String> = emptyMap()) {
        val open = {
            request(
                "ssh.shell.open",
                JSONObject()
                    .put("sshSessionId", sessionId)
                    .put("sshShellId", shellId)
                    .put("dataChannelId", dataChannelId)
                    .put("term", terminalType)
                    .put("envs", JSONObject(envs))
                    .put("size", size(columns, rows))
                .toString(),
            )
            if (startupCommand.isNotBlank()) {
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    send((startupCommand + "\n").toByteArray(Charsets.UTF_8))
                }, 150)
            }
        }
        if (readyChannels.contains(channelId) && readyChannels.contains(dataChannelId)) open() else pendingOpen = open
    }

    fun send(data: ByteArray) {
        if (!closed.get() && opened.get()) runtime.sendBinary(dataChannelId, data)
    }

    fun resize(columns: Int, rows: Int) {
        request(
            "ssh.shell.resize",
            JSONObject().put("sshShellId", shellId)
                .put("size", size(columns, rows))
                .toString(),
        )
    }

    fun closeShell() {
        request("ssh.shell.close", JSONObject().put("sshShellId", shellId).toString())
    }

    private fun size(columns: Int, rows: Int): JSONObject =
        JSONObject().put("col", columns).put("row", rows).put("width", 0).put("height", 0)

    private fun request(method: String, data: String) {
        if (closed.get() || !opened.get() || !readyChannels.contains(channelId)) return
        runtime.requestOnChannel(channelId, method, JSONObject(data)) { response ->
            if (response.has("error")) {
                Log.e("Shell360Terminal", "$method failed: ${response.optJSONObject("error")?.optString("message")}")
            }
        }
    }

    private fun channelOpened(id: String) {
        readyChannels += id
        if (readyChannels.contains(channelId) && readyChannels.contains(dataChannelId)) {
            pendingOpen?.invoke()
            pendingOpen = null
        }
    }

    fun close() {
        if (!closed.compareAndSet(false, true)) return
        opened.set(false)
        pendingOpen = null
        readyChannels.clear()
        removeEofListener?.invoke()
        removeCloseListener?.invoke()
        removeEofListener = null
        removeCloseListener = null
        runtime.closeChannel(channelId)
        runtime.closeChannel(dataChannelId)
    }

    private fun handleRemoteClose() {
        if (!closed.get()) {
            close()
            onClose()
        }
    }
}
