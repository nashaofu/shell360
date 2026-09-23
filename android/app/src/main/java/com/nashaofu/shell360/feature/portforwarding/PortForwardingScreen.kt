package com.nashaofu.shell360.feature.portforwarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.activity.compose.BackHandler
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PortForwardingScreen(
    viewModel: PortForwardingViewModel = remember { PortForwardingViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    if (state.isEditorOpen) {
        PortForwardingEditorPage(state.editorItem, { viewModel.onAction(PortForwardingAction.EditorDismissed) }) { viewModel.onAction(PortForwardingAction.Saved(it)) }
        return
    }
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onOpenNavigation) {
                        Icon(Icons.Default.Menu, contentDescription = "Open navigation menu")
                    }
                },
                title = { Text("Port Forwarding") },
                actions = {
                    IconButton(onClick = { viewModel.onAction(PortForwardingAction.AddClicked) }) {
                        Icon(Icons.Default.Add, contentDescription = "Add port forwarding")
                    }
                },
            )
        },
        snackbarHost = {
            state.feedbackMessage?.let { message ->
                Snackbar(action = {
                    TextButton(onClick = { viewModel.onAction(PortForwardingAction.FeedbackDismissed) }) {
                        Text("Dismiss")
                    }
                }) { Text(message) }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onAction(PortForwardingAction.QueryChanged(it)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search port forwarding") },
                trailingIcon = if (state.query.isNotEmpty()) {
                    { TextButton(onClick = { viewModel.onAction(PortForwardingAction.QueryChanged("")) }) { Text("Clear") } }
                } else null,
                placeholder = { Text("Search port forwarding") },
            )
            if (state.isLoading) {
                androidx.compose.foundation.layout.Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (state.items.isEmpty()) {
                EmptyState(onAdd = { viewModel.onAction(PortForwardingAction.AddClicked) })
            } else if (viewModel.visibleItems.isEmpty()) {
                Text("No port forwarding matches your search.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(viewModel.visibleItems, key = { it.id }) { item ->
                        PortForwardingCard(
                            item = item,
                            onEdit = { viewModel.onAction(PortForwardingAction.EditClicked(item)) },
                            onDelete = { viewModel.onAction(PortForwardingAction.DeleteClicked(item)) },
                            onRuntime = { viewModel.onAction(PortForwardingAction.RuntimeRequested(item)) },
                        )
                    }
                }
            }
        }
    }
    state.pendingDelete?.let { item ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Delete port forwarding") },
            text = { Text("Delete ${item.name}? This only removes the saved configuration.") },
            confirmButton = { TextButton(onClick = viewModel::confirmDelete) { Text("Delete") } },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Cancel") } },
        )
    }
}

@Composable
private fun EmptyState(onAdd: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(bottom = 48.dp), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("No port forwarding yet", style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(
            "Add a configuration to prepare a local, remote, or dynamic tunnel.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            textAlign = TextAlign.Center,
        )
        Button(onClick = onAdd, modifier = Modifier.padding(top = 20.dp)) {
            Icon(Icons.Default.Add, contentDescription = "Add port forwarding")
            Spacer(Modifier.width(8.dp))
            Text("Add port forwarding")
        }
    }
}

@Composable
private fun PortForwardingCard(
    item: PortForwardingItem,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onRuntime: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row {
                Column(Modifier.weight(1f)) {
                    Text(item.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${item.type.label} · ${item.localAddress}:${item.localPort}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        if (item.type == PortForwardingType.Dynamic) "Proxy through ${item.hostId}"
                        else "${item.remoteAddress}:${item.remotePort} through ${item.hostId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                AssistChip(onClick = onRuntime, label = { Text("Not connected") })
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "More actions for ${item.name}")
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(text = { Text("Edit") }, onClick = { menuOpen = false; onEdit() }, leadingIcon = { Icon(Icons.Default.Edit, contentDescription = "Edit port forwarding") })
                    DropdownMenuItem(text = { Text("Delete") }, onClick = { menuOpen = false; onDelete() }, leadingIcon = { Icon(Icons.Default.DeleteOutline, contentDescription = "Delete port forwarding") })
                }
            }
            OutlinedButton(onClick = onRuntime, modifier = Modifier.fillMaxWidth()) { Text("Start (not connected)") }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun PortForwardingEditorPage(
    item: PortForwardingItem?,
    onDismiss: () -> Unit,
    onSave: (PortForwardingItem) -> Unit,
) {
    var name by remember(item) { mutableStateOf(item?.name.orEmpty()) }
    var hostId by remember(item) { mutableStateOf(item?.hostId.orEmpty()) }
    var localAddress by remember(item) { mutableStateOf(item?.localAddress ?: "127.0.0.1") }
    var localPort by remember(item) { mutableStateOf(item?.localPort?.toString() ?: "8080") }
    var remoteAddress by remember(item) { mutableStateOf(item?.remoteAddress.orEmpty()) }
    var remotePort by remember(item) { mutableStateOf(item?.remotePort?.toString().orEmpty()) }
    var type by remember(item) { mutableStateOf(item?.type ?: PortForwardingType.Local) }
    var showDiscard by remember { mutableStateOf(false) }
    val isDirty = name != item?.name.orEmpty() || hostId != item?.hostId.orEmpty() || localAddress != (item?.localAddress ?: "127.0.0.1") || localPort != (item?.localPort?.toString() ?: "8080") || remoteAddress != item?.remoteAddress.orEmpty() || remotePort != item?.remotePort?.toString().orEmpty() || type != (item?.type ?: PortForwardingType.Local)
    val requestDismiss = { if (isDirty) showDiscard = true else onDismiss() }
    BackHandler(onBack = requestDismiss)
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = requestDismiss) { Icon(Icons.Default.Close, "Close editor") } },
                title = { Text(if (item == null) "Add port forwarding" else "Edit port forwarding") },
                actions = {
                    TextButton(
                        enabled = name.isNotBlank() && hostId.isNotBlank() && localPort.toIntOrNull() in 1..65535 && (type == PortForwardingType.Dynamic || (remoteAddress.isNotBlank() && remotePort.toIntOrNull() in 1..65535)),
                        onClick = { onSave(PortForwardingItem(item?.id ?: "forwarding-${System.currentTimeMillis()}", name.trim(), type, hostId.trim(), localAddress.trim(), localPort.toInt(), remoteAddress.trim(), remotePort.toIntOrNull())) },
                    ) { Text("Save") }
                },
            )
        },
    ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Forwarding details", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                Text("Tunnel type", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PortForwardingType.entries.forEach { option ->
                        FilterChip(selected = type == option, onClick = { type = option }, label = { Text(option.name) })
                    }
                }
                OutlinedTextField(hostId, { hostId = it }, label = { Text("Host ID") }, singleLine = true)
                OutlinedTextField(localAddress, { localAddress = it }, label = { Text("Local address") }, singleLine = true)
                OutlinedTextField(localPort, { localPort = it.filter(Char::isDigit) }, label = { Text("Local port") }, singleLine = true)
                if (type != PortForwardingType.Dynamic) {
                    OutlinedTextField(remoteAddress, { remoteAddress = it }, label = { Text("Remote address") }, singleLine = true)
                    OutlinedTextField(remotePort, { remotePort = it.filter(Char::isDigit) }, label = { Text("Remote port") }, singleLine = true)
                }
            }
    }
    if (showDiscard) {
        AlertDialog(
            onDismissRequest = { showDiscard = false },
            title = { Text("Discard changes?") },
            text = { Text("Your changes will not be saved.") },
            confirmButton = { TextButton(onClick = onDismiss) { Text("Discard") } },
            dismissButton = { TextButton(onClick = { showDiscard = false }) { Text("Keep editing") } },
        )
    }
}
