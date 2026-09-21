package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalLocale
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.R
import java.text.SimpleDateFormat
import java.util.Date

@androidx.compose.material3.ExperimentalMaterial3Api
@Composable
fun WorkspaceScreen(
    sessions: List<NativeWorkspaceSession>,
    activeSessionId: String? = null,
    activeSurface: (@Composable () -> Unit)? = null,
    sessionPickerRequest: Int = 0,
    onBack: () -> Unit,
    onSelectSession: (String) -> Unit,
    onCloseSession: (String) -> Unit,
    onRetrySession: (String) -> Unit = {},
    onRemoveSession: (String) -> Unit = onCloseSession,
    onEditHost: (String) -> Unit = {},
    onViewHosts: () -> Unit = {},
    onOpenDrawer: (() -> Unit)? = null,
) {
    var showSessionPicker by remember { mutableStateOf(false) }
    var pendingCloseSession by remember { mutableStateOf<NativeWorkspaceSession?>(null) }
    LaunchedEffect(sessionPickerRequest) {
        if (sessionPickerRequest > 0) showSessionPicker = true
    }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            NativeTopBar(
                title = "Workspace",
                onBack = onBack,
                onOpenDrawer = onOpenDrawer,
                actions = {
                    IconButton(onClick = { showSessionPicker = true }, modifier = Modifier.size(48.dp)) {
                        androidx.compose.foundation.Image(
                            painterResource(R.drawable.ic_workspace),
                            contentDescription = "Open sessions",
                            modifier = Modifier.size(20.dp),
                            colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant),
                        )
                    }
                },
            )
        },
    ) { padding ->
        if (sessions.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                androidx.compose.foundation.Image(
                    painter = painterResource(R.drawable.ic_workspace),
                    contentDescription = null,
                    modifier = Modifier.size(64.dp).padding(bottom = 12.dp),
                    colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary),
                )
                Text("No active sessions", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Open a Terminal or SFTP session from Hosts.",
                    modifier = Modifier.padding(top = 8.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                androidx.compose.material3.OutlinedButton(
                    onClick = onViewHosts,
                    modifier = Modifier.padding(top = 16.dp),
                ) { Text("View Hosts") }
            }
        } else {
            BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
                val expanded = maxWidth >= 600.dp
                if (expanded) {
                    Row(Modifier.fillMaxSize()) {
                        LazyColumn(
                            modifier = Modifier.width(340.dp),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            sessionGroup("Terminals", sessions.filter { it.type != "SFTP" }, activeSessionId, onSelectSession, { pendingCloseSession = it }, onRetrySession, onRemoveSession, onEditHost)
                            sessionGroup("SFTP", sessions.filter { it.type == "SFTP" }, activeSessionId, onSelectSession, { pendingCloseSession = it }, onRetrySession, onRemoveSession, onEditHost)
                        }
                        androidx.compose.material3.VerticalDivider()
                        Column(
                            Modifier.weight(1f).fillMaxSize().padding(24.dp),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            val active = sessions.firstOrNull { it.id == activeSessionId }
                            if (active == null) {
                                Text("Select a session", style = MaterialTheme.typography.titleMedium)
                                Text("Choose a Terminal or SFTP session from the list.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                            } else {
                                if (activeSurface == null) {
                                    Text(active.title, style = MaterialTheme.typography.titleLarge)
                                    Text("${active.type} · ${active.state}", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                                    androidx.compose.material3.Button(onClick = { onSelectSession(active.id) }, modifier = Modifier.padding(top = 16.dp)) { Text("Open ${active.type}") }
                                } else {
                                    activeSurface()
                                }
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        sessionGroup("Terminals", sessions.filter { it.type != "SFTP" }, activeSessionId, onSelectSession, { pendingCloseSession = it }, onRetrySession, onRemoveSession, onEditHost)
                        sessionGroup("SFTP", sessions.filter { it.type == "SFTP" }, activeSessionId, onSelectSession, { pendingCloseSession = it }, onRetrySession, onRemoveSession, onEditHost)
                    }
                }
            }
        }
    }
    if (showSessionPicker) {
        ModalBottomSheet(onDismissRequest = { showSessionPicker = false }) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("Sessions", style = MaterialTheme.typography.titleLarge)
                Text("${sessions.size} active sessions", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
                sessions.forEach { session ->
                    ShellCard(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp).clickable {
                            showSessionPicker = false
                            onSelectSession(session.id)
                        },
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(session.title, style = MaterialTheme.typography.titleMedium)
                            if (session.id == activeSessionId) Text("Active session", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                            Text("${session.type} · ${session.state}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
    pendingCloseSession?.let { session ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { pendingCloseSession = null },
            title = { Text("Close session?") },
            text = { Text("The live ${session.type} session will be disconnected and removed from Workspace.") },
            confirmButton = {
                androidx.compose.material3.Button(onClick = {
                    pendingCloseSession = null
                    onCloseSession(session.id)
                }) { Text("Close session") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { pendingCloseSession = null }) { Text("Cancel") }
            },
        )
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.sessionGroup(
    title: String,
    sessions: List<NativeWorkspaceSession>,
    activeSessionId: String?,
    onSelectSession: (String) -> Unit,
    requestCloseSession: (NativeWorkspaceSession) -> Unit,
    onRetrySession: (String) -> Unit,
    onRemoveSession: (String) -> Unit,
    onEditHost: (String) -> Unit,
) {
    if (sessions.isEmpty()) return
    item { Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)) }
    items(sessions, key = { it.id }) { session ->
        ShellCard(
            modifier = Modifier.fillMaxWidth().clickable { onSelectSession(session.id) },
            containerColor = if (session.id == activeSessionId) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ) {
            Row(modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                val statusIcon = when (session.state) {
                    "Connected" -> R.drawable.ic_workspace
                    "VerifyingHost" -> R.drawable.ic_fingerprint
                    "Authenticating" -> R.drawable.ic_lock
                    "Connecting" -> R.drawable.ic_refresh
                    "Error" -> R.drawable.ic_fingerprint
                    "Cancelled", "Disconnected", "Closing", "Closed" -> R.drawable.ic_close
                    else -> R.drawable.ic_workspace
                }
                androidx.compose.foundation.Image(
                    painterResource(statusIcon),
                    "${session.state} status",
                    Modifier.padding(end = 10.dp).size(20.dp),
                    colorFilter = ColorFilter.tint(if (session.state == "Error") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(session.title, style = MaterialTheme.typography.titleSmall)
                    Text(
                        listOf(session.type, session.state).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (session.state == "Error") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (session.createdAt > 0L) {
                        Text(
                            "Started ${SimpleDateFormat("HH:mm", LocalLocale.current.platformLocale).format(Date(session.createdAt))}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    session.errorMessage?.let { message ->
                        Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, maxLines = 2)
                    }
                }
                if (session.state == "Error" || session.state == "Cancelled" || session.state == "Disconnected") {
                    IconButton(onClick = { onRetrySession(session.id) }, modifier = Modifier.size(44.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_refresh), "Retry ${session.title}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary))
                    }
                    IconButton(onClick = { onEditHost(session.hostId) }, modifier = Modifier.size(44.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_more), "Edit ${session.title}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant))
                    }
                    IconButton(onClick = { onRemoveSession(session.id) }, modifier = Modifier.size(44.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_delete), "Remove ${session.title}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.error))
                    }
                } else {
                    IconButton(onClick = { requestCloseSession(session) }, modifier = Modifier.size(44.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_close), "Close ${session.title}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant))
                    }
                }
            }
        }
    }
}
