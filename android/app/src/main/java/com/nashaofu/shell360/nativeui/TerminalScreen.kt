package com.nashaofu.shell360.nativeui

import android.view.ViewGroup
import android.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import com.termux.terminal.TerminalSession
import com.termux.view.TerminalView
import com.nashaofu.shell360.terminal.Shell360TerminalClient

@Composable
fun TerminalScreen(
    session: com.nashaofu.shell360.terminal.NativeTerminalSession,
    sshSessionId: String,
    terminalType: String = "xterm-256color",
    startupCommand: String = "",
    envs: Map<String, String> = emptyMap(),
    fontSize: Int = 18,
    showShortcutBar: Boolean = true,
    modifier: Modifier = Modifier,
    onInput: (ByteArray) -> Unit,
    onResize: (Int, Int) -> Unit,
    onClose: () -> Unit,
) {
    val terminalViewRef = remember { arrayOfNulls<TerminalView>(1) }
    Column(modifier = modifier) {
        AndroidView(
        modifier = Modifier.weight(1f),
        factory = { context ->
            TerminalView(context, null).apply {
                layoutParams = ViewGroup.LayoutParams(-1, -1)
                setBackgroundColor(Color.BLACK)
                val terminalView = this
                val client = Shell360TerminalClient(
                    { data, offset, count -> onInput(data.copyOfRange(offset, offset + count)) },
                    onClose,
                    { terminalView.postInvalidate() },
                )
                setTerminalViewClient(client)
                val terminalSession = TerminalSession(2000, client, client)
                // TerminalView calls updateSize() during its first layout. Initialize the
                // renderer before attaching the session so that updateSize can calculate
                // columns and rows safely.
                setTextSize(fontSize)
                attachSession(terminalSession)
                addOnLayoutChangeListener { view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
                    if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) {
                        val columns = maxOf(1, (right - left) / 9)
                        val rows = maxOf(1, (bottom - top) / 18)
                        terminalSession.updateSize(columns, rows, 9, 18)
                        onResize(columns, rows)
                    }
                }
                post {
                    val columns = maxOf(1, width / 9)
                    val rows = maxOf(1, height / 18)
                    terminalSession.updateSize(columns, rows, 9, 18)
                    session.setOnOutput { bytes ->
                        terminalView.post {
                            terminalSession.appendExternalOutput(bytes, 0, bytes.size)
                        }
                    }
                    session.open()
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        session.openShell(sshSessionId, columns, rows, terminalType, startupCommand, envs)
                        onResize(columns, rows)
                    }, 250)
                }
                tag = terminalSession
                terminalViewRef[0] = this
            }
        },
        onRelease = { view ->
            (view.tag as? TerminalSession)?.finishIfRunning()
            view.tag = null
        },
        update = { view ->
            val terminalSession = view.tag as? TerminalSession
            if (terminalSession != null && view.width > 0 && view.height > 0) {
                onResize(maxOf(1, view.width / 9), maxOf(1, view.height / 18))
            }
        },
        )
        Row(
            Modifier.fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 8.dp, vertical = 2.dp)
                .navigationBarsPadding()
                .height(40.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (showShortcutBar) listOf("Esc" to byteArrayOf(0x1b), "Tab" to byteArrayOf(0x09), "Ctrl" to byteArrayOf(0x1b, 0x5b, 0x32, 0x30, 0x30, 0x7e), "↑" to byteArrayOf(0x1b, 0x5b, 0x41), "↓" to byteArrayOf(0x1b, 0x5b, 0x42), "←" to byteArrayOf(0x1b, 0x5b, 0x44), "→" to byteArrayOf(0x1b, 0x5b, 0x43)).forEach { (label, bytes) ->
                    androidx.compose.material3.TextButton(onClick = { onInput(bytes) }, modifier = Modifier.height(36.dp)) { androidx.compose.material3.Text(label) }
            }
            IconButton(
                onClick = {
                    terminalViewRef[0]?.let { view ->
                        view.requestFocus()
                        val input = view.context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                        input.showSoftInput(view, 0)
                    }
                },
                modifier = Modifier.size(40.dp).border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(6.dp)),
            ) {
                androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_keyboard), "Keyboard", Modifier.size(18.dp))
            }
        }
    }
}
