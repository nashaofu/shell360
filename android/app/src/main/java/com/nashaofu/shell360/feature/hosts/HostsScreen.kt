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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun HostsScreen(
    viewModel: HostsViewModel = remember { HostsViewModel() },
    onOpenSsh: (HostItem) -> Unit = {},
    onOpenSftp: (HostItem) -> Unit = {},
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
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
                    IconButton(onClick = { viewModel.openEditor() }) {
                        Icon(Icons.Default.Add, contentDescription = "Add host")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.openEditor() }) {
                Icon(Icons.Default.Add, contentDescription = "Add host")
            }
        },
        containerColor = Color(0xFFF5F7F5),
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = if (state.query.isNotEmpty()) {
                    { IconButton(onClick = { viewModel.setQuery("") }) { Icon(Icons.Default.Close, "Clear search") } }
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
                        onClick = { viewModel.setSelectedTag(null) },
                        label = { Text("All") },
                    )
                    viewModel.tags.forEach { tag ->
                        FilterChip(
                            selected = state.selectedTag == tag,
                            onClick = { viewModel.setSelectedTag(if (state.selectedTag == tag) null else tag) },
                            label = { Text(tag) },
                        )
                    }
                }
            }
            if (viewModel.visibleHosts.isEmpty()) {
                HostsEmptyState(
                    hasHosts = state.hosts.isNotEmpty(),
                    onAdd = { viewModel.openEditor() },
                    onClear = { viewModel.setQuery(""); viewModel.setSelectedTag(null) },
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
                            onEdit = { viewModel.openEditor(host) },
                            onDelete = { viewModel.deleteHost(host) },
                            onOpenSsh = { onOpenSsh(host) },
                            onOpenSftp = { onOpenSftp(host) },
                        )
                    }
                }
            }
        }
    }
    if (state.isEditorOpen) {
        HostEditorDialog(
            host = state.editorHost,
            onDismiss = viewModel::closeEditor,
            onSave = viewModel::saveHost,
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
            Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Terminal, null, modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.primary) }
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
        if (hasHosts) OutlinedButton(onClick = onClear) { Text("Clear filters") } else Button(onClick = onAdd) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(8.dp)); Text("Add host") }
    }
}

@Composable
private fun HostCard(host: HostItem, onEdit: () -> Unit, onDelete: () -> Unit, onOpenSsh: () -> Unit, onOpenSftp: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
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
                    IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.Edit, "Host actions") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Edit") }, onClick = { menuOpen = false; onEdit() }, leadingIcon = { Icon(Icons.Default.Edit, null) })
                        DropdownMenuItem(text = { Text("Delete") }, onClick = { menuOpen = false; onDelete() }, leadingIcon = { Icon(Icons.Default.DeleteOutline, null) })
                    }
                }
            }
            if (host.tags.isNotEmpty()) {
                Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) { host.tags.forEach { AssistChip(onClick = {}, label = { Text(it) }) } }
            }
            HorizontalDivider(Modifier.padding(vertical = 14.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = onOpenSsh, modifier = Modifier.weight(1f)) { Icon(Icons.Default.Terminal, null); Spacer(Modifier.width(6.dp)); Text("SSH") }
                OutlinedButton(onClick = onOpenSftp, modifier = Modifier.weight(1f)) { Icon(Icons.Default.UploadFile, null); Spacer(Modifier.width(6.dp)); Text("SFTP") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HostEditorDialog(host: HostItem?, onDismiss: () -> Unit, onSave: (HostItem) -> Unit) {
    var name by remember(host) { mutableStateOf(host?.name.orEmpty()) }
    var hostname by remember(host) { mutableStateOf(host?.hostname.orEmpty()) }
    var username by remember(host) { mutableStateOf(host?.username.orEmpty()) }
    var port by remember(host) { mutableStateOf(host?.port?.toString() ?: "22") }
    var tag by remember(host) { mutableStateOf(host?.tags?.firstOrNull().orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (host == null) "Add host" else "Edit host") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(hostname, { hostname = it }, label = { Text("Hostname") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(username, { username = it }, label = { Text("Username") }, modifier = Modifier.weight(1f), singleLine = true)
                    OutlinedTextField(port, { port = it.filter(Char::isDigit) }, label = { Text("Port") }, modifier = Modifier.width(92.dp), singleLine = true)
                }
                OutlinedTextField(tag, { tag = it }, label = { Text("Tag (optional)") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(enabled = name.isNotBlank() && hostname.isNotBlank(), onClick = {
                onSave(HostItem(host?.id ?: "host-${System.currentTimeMillis()}", name.trim(), hostname.trim(), username.trim(), port.toIntOrNull() ?: 22, tag.trim().takeIf { it.isNotEmpty() }?.let(::listOf).orEmpty()))
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
