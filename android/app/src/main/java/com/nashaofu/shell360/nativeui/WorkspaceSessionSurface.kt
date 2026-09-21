package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier
import com.nashaofu.shell360.R
import com.nashaofu.shell360.session.ActiveSftpSession
import com.nashaofu.shell360.session.ActiveTerminalSession

@Composable
fun WorkspaceSessionSurface(
    terminal: ActiveTerminalSession?,
    sftp: ActiveSftpSession?,
    onLeave: () -> Unit,
    onShowSessions: () -> Unit,
    onClose: () -> Unit,
    defaultFontSize: Int = 18,
    defaultTerminalType: String = "xterm-256color",
    shortcutBar: Boolean = true,
) {
    var confirmClose by remember { mutableStateOf(false) }
    if (confirmClose) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmClose = false },
            title = { androidx.compose.material3.Text("Close session?") },
            text = { androidx.compose.material3.Text("The live session will be disconnected and removed from Workspace.") },
            confirmButton = { androidx.compose.material3.Button(onClick = { confirmClose = false; onClose() }) { androidx.compose.material3.Text("Close session") } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { confirmClose = false }) { androidx.compose.material3.Text("Cancel") } },
        )
    }
    terminal?.let { active ->
        Column(Modifier.fillMaxSize()) {
            NativeTopBar(
                title = "Workspace",
                onBack = onLeave,
                actions = {
                    IconButton(onClick = onShowSessions, modifier = Modifier.size(48.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_workspace), "Open sessions", Modifier.size(20.dp), colorFilter = ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant))
                    }
                    IconButton(onClick = { confirmClose = true }, modifier = Modifier.size(48.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_close), "Close session", Modifier.size(20.dp), colorFilter = ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant))
                    }
                },
            )
            TerminalScreen(
                session = active.terminal,
                sshSessionId = active.ssh.id,
                terminalType = active.host.terminalType.ifBlank { defaultTerminalType },
                envs = active.host.envs,
                fontSize = if (active.host.terminalFontSize == 18) defaultFontSize else active.host.terminalFontSize,
                showShortcutBar = shortcutBar,
                startupCommand = active.host.startupCommand,
                modifier = Modifier.weight(1f),
                onInput = active.terminal::send,
                onResize = active.terminal::resize,
                onClose = { confirmClose = true },
            )
        }
        return
    }
    sftp?.let { active ->
        SftpScreen(
            session = active.sftp,
            onBack = onLeave,
            onShowSessions = onShowSessions,
            onCloseSession = onClose,
        )
    }
}
