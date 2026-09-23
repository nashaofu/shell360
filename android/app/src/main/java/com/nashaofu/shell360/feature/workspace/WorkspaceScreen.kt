package com.nashaofu.shell360.feature.workspace

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.feature.sftp.SftpScreen
import com.nashaofu.shell360.feature.terminal.TerminalScreen

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun WorkspaceScreen(
    viewModel: WorkspaceViewModel = remember { WorkspaceViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    val active = viewModel.activeSession
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onOpenNavigation) { Icon(Icons.Default.Menu, "Open navigation menu") } },
                title = { Text("Workspace") },
                actions = {
                    if (active != null) IconButton(onClick = { viewModel.onAction(WorkspaceAction.CloseSessionRequested) }) { Icon(Icons.Default.Close, "Close session") }
                },
            )
        },
        snackbarHost = {
            state.feedbackMessage?.let { message ->
                Snackbar(action = { TextButton(onClick = { viewModel.onAction(WorkspaceAction.FeedbackDismissed) }) { Text("Dismiss") } }) { Text(message) }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (active == null) {
                EmptyWorkspace(onViewHosts = onOpenNavigation)
            } else {
                SessionHeader(active, onOpenPicker = { viewModel.onAction(WorkspaceAction.SessionPickerOpened) })
                when (active.type) {
                    WorkspaceSessionType.Terminal -> TerminalScreen()
                    WorkspaceSessionType.Sftp -> SftpScreen()
                }
            }
        }
    }
    if (state.isSessionPickerOpen) {
        ModalBottomSheet(onDismissRequest = { viewModel.onAction(WorkspaceAction.SessionPickerClosed) }, sheetState = rememberModalBottomSheetState()) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Sessions", style = MaterialTheme.typography.headlineSmall)
                if (state.sessions.isEmpty()) {
                    Text("No active sessions", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "Open a Terminal or SFTP session from Hosts when Android runtime support is available.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        val terminals = state.sessions.filter { it.type == WorkspaceSessionType.Terminal }
                        if (terminals.isNotEmpty()) {
                            item { Text("Terminals", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary) }
                            items(terminals, key = { it.id }) { session ->
                                SessionRow(session) { viewModel.onAction(WorkspaceAction.SessionSelected(session.id)) }
                            }
                        }
                        val sftp = state.sessions.filter { it.type == WorkspaceSessionType.Sftp }
                        if (sftp.isNotEmpty()) {
                            item { Text("SFTP", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary) }
                            items(sftp, key = { it.id }) { session ->
                                SessionRow(session) { viewModel.onAction(WorkspaceAction.SessionSelected(session.id)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyWorkspace(onViewHosts: () -> Unit) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("No active sessions", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text("Open a Terminal or SFTP session from Hosts.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), textAlign = TextAlign.Center)
        Button(onClick = onViewHosts, modifier = Modifier.padding(top = 20.dp)) { Text("View Hosts") }
    }
}

@Composable
private fun SessionHeader(session: WorkspaceSession, onOpenPicker: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), onClick = onOpenPicker) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("${session.title} · ${session.type.name}", style = MaterialTheme.typography.titleMedium)
                Text(session.context, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(session.status.name, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun SessionRow(session: WorkspaceSession, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text("${session.title} · ${session.type.name}", Modifier.weight(1f))
        Text(session.status.name, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
