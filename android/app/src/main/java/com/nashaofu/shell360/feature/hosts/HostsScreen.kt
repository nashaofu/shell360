package com.nashaofu.shell360.feature.hosts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.UploadFile
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Surface
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun HostsScreen(
    viewModel: HostsViewModel = remember { HostsViewModel() },
    onOpenSsh: ((HostItem) -> Unit)? = null,
    onOpenSftp: ((HostItem) -> Unit)? = null,
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    if (state.isEditorOpen) {
        HostEditorPage(
            host = state.editorHost,
            onDismiss = { viewModel.onAction(HostsAction.EditorDismissed) },
            onSave = { viewModel.onAction(HostsAction.HostSaved(it)) },
        )
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
                title = {
                    Text("Hosts", fontWeight = FontWeight.SemiBold)
                },
                actions = {
                    IconButton(onClick = { viewModel.onAction(HostsAction.AddClicked) }) {
                        Icon(Icons.Default.Add, contentDescription = "Add host")
                    }
                },
            )
        },
        snackbarHost = {
            state.feedbackMessage?.let { message ->
                Snackbar(action = { TextButton(onClick = viewModel::dismissFeedback) { Text("Dismiss") } }) {
                    Text(message)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
            Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onAction(HostsAction.QueryChanged(it)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search hosts") },
                trailingIcon = if (state.query.isNotEmpty()) {
                    { IconButton(onClick = { viewModel.onAction(HostsAction.QueryChanged("")) }) { Icon(Icons.Default.Close, "Clear search") } }
                } else null,
                placeholder = { Text("Search by name, host, or tag") },
            )
            if (viewModel.tags.isNotEmpty()) {
                Row(
                    modifier = Modifier.padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FilterChip(
                        selected = state.selectedTag == null,
                        onClick = { viewModel.onAction(HostsAction.TagSelected(null)) },
                        label = { Text("All") },
                    )
                    viewModel.tags.forEach { tag ->
                        FilterChip(
                            selected = state.selectedTag == tag,
                            onClick = { viewModel.onAction(HostsAction.TagSelected(if (state.selectedTag == tag) null else tag)) },
                            label = { Text(tag) },
                        )
                    }
                }
            }
            if (state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (viewModel.visibleHosts.isEmpty()) {
                HostsEmptyState(
                    hasHosts = state.hosts.isNotEmpty(),
                    onAdd = { viewModel.onAction(HostsAction.AddClicked) },
                    onClear = { viewModel.onAction(HostsAction.ClearFiltersClicked) },
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 96.dp),
                ) {
                    items(viewModel.visibleHosts, key = { it.id }) { host ->
                        HostCard(
                            host = host,
                            onEdit = { viewModel.onAction(HostsAction.EditClicked(host)) },
                            onDuplicate = { viewModel.onAction(HostsAction.DuplicateClicked(host)) },
                            onDelete = { viewModel.onAction(HostsAction.DeleteClicked(host)) },
                            onOpenSsh = { onOpenSsh?.invoke(host) ?: viewModel.onAction(HostsAction.ConnectionRequested("SSH")) },
                            onOpenSftp = { onOpenSftp?.invoke(host) ?: viewModel.onAction(HostsAction.ConnectionRequested("SFTP")) },
                        )
                    }
                }
            }
        }
    }
    state.deleteTarget?.let { host ->
        AlertDialog(
            onDismissRequest = { viewModel.onAction(HostsAction.DeleteDismissed) },
            title = { Text("Delete host?") },
            text = { Text("Remove ${host.name} from the saved hosts list?") },
            confirmButton = {
                TextButton(onClick = { viewModel.onAction(HostsAction.DeleteConfirmed) }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.onAction(HostsAction.DeleteDismissed) }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun HostsEmptyState(hasHosts: Boolean, onAdd: () -> Unit, onClear: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(bottom = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.size(72.dp)) {
            Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Terminal, "Terminal session", modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.primary) }
        }
        Spacer(Modifier.height(18.dp))
        Text(if (hasHosts) "No matching hosts" else "No hosts yet", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(
            if (hasHosts) "Try another search or clear your filters." else "Add a host to start an SSH or SFTP session.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
        Spacer(Modifier.height(20.dp))
        if (hasHosts) OutlinedButton(onClick = onClear) { Text("Clear filters") } else Button(onClick = onAdd) { Icon(Icons.Default.Add, "Add host"); Spacer(Modifier.width(8.dp)); Text("Add host") }
    }
}

@Composable
private fun HostCard(host: HostItem, onEdit: () -> Unit, onDuplicate: () -> Unit, onDelete: () -> Unit, onOpenSsh: () -> Unit, onOpenSftp: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(46.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
                    Text(host.name.take(1).uppercase(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.padding(start = 12.dp).weight(1f)) {
                    Text(host.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("${host.username}@${host.hostname}:${host.port}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Box {
                    IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More host actions") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Edit") }, onClick = { menuOpen = false; onEdit() }, leadingIcon = { Icon(Icons.Default.Edit, "Edit host") })
                        DropdownMenuItem(text = { Text("Duplicate") }, onClick = { menuOpen = false; onDuplicate() }, leadingIcon = { Icon(Icons.Default.ContentCopy, "Duplicate host") })
                        DropdownMenuItem(text = { Text("Delete") }, onClick = { menuOpen = false; onDelete() }, leadingIcon = { Icon(Icons.Default.DeleteOutline, "Delete host") })
                    }
                }
            }
            if (host.tags.isNotEmpty()) {
                Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) { host.tags.forEach { AssistChip(onClick = {}, label = { Text(it) }) } }
            }
            HorizontalDivider(Modifier.padding(vertical = 14.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = onOpenSsh, modifier = Modifier.weight(1f)) { Icon(Icons.Default.Terminal, "Open SSH"); Spacer(Modifier.width(6.dp)); Text("SSH") }
                OutlinedButton(onClick = onOpenSftp, modifier = Modifier.weight(1f)) { Icon(Icons.Default.UploadFile, "Open SFTP"); Spacer(Modifier.width(6.dp)); Text("SFTP") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HostEditorPage(host: HostItem?, onDismiss: () -> Unit, onSave: (HostItem) -> Unit) {
    var name by remember(host) { mutableStateOf(host?.name.orEmpty()) }
    var hostname by remember(host) { mutableStateOf(host?.hostname.orEmpty()) }
    var username by remember(host) { mutableStateOf(host?.username.orEmpty()) }
    var port by remember(host) { mutableStateOf(host?.port?.toString() ?: "22") }
    var tag by remember(host) { mutableStateOf(host?.tags?.firstOrNull().orEmpty()) }
    var showDiscard by remember { mutableStateOf(false) }
    val isDirty = name != host?.name.orEmpty() || hostname != host?.hostname.orEmpty() || username != host?.username.orEmpty() || port != (host?.port?.toString() ?: "22") || tag != host?.tags?.firstOrNull().orEmpty()
    val requestDismiss = { if (isDirty) showDiscard = true else onDismiss() }
    BackHandler(onBack = requestDismiss)
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = requestDismiss) { Icon(Icons.Default.Close, "Close editor") } },
                title = { Text(if (host == null) "Add host" else "Edit host") },
                actions = {
                    TextButton(enabled = name.isNotBlank() && hostname.isNotBlank(), onClick = {
                        onSave(HostItem(host?.id ?: "host-${System.currentTimeMillis()}", name.trim(), hostname.trim(), username.trim(), port.toIntOrNull() ?: 22, tag.trim().takeIf { it.isNotEmpty() }?.let(::listOf).orEmpty()))
                    }) { Text("Save") }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Basic information", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(hostname, { hostname = it }, label = { Text("Hostname") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(username, { username = it }, label = { Text("Username") }, modifier = Modifier.weight(1f), singleLine = true)
                OutlinedTextField(port, { port = it.filter(Char::isDigit) }, label = { Text("Port") }, modifier = Modifier.width(92.dp), singleLine = true)
            }
            Text("Organization", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
            OutlinedTextField(tag, { tag = it }, label = { Text("Tag (optional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Text("Authentication settings will be added here when Android host storage is connected.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
