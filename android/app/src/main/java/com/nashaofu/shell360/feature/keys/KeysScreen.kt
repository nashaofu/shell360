package com.nashaofu.shell360.feature.keys

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun KeysScreen(
    viewModel: KeysViewModel = remember { KeysViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    if (state.isEditorOpen) {
        KeyEditorPage(state.editorKey, { viewModel.onAction(KeysAction.EditorDismissed) }) { viewModel.onAction(KeysAction.Saved(it)) }
        return
    }
    if (state.isGeneratorOpen) {
        BackHandler(onBack = { viewModel.onAction(KeysAction.GeneratorDismissed) })
        KeyGeneratorPage({ viewModel.onAction(KeysAction.GeneratorDismissed) }) { viewModel.onAction(KeysAction.GenerationRequested) }
        return
    }
    var addMenuOpen by remember { mutableStateOf(false) }
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onOpenNavigation) { Icon(Icons.Default.Menu, "Open navigation menu") }
                },
                title = { Text("Keys") },
                actions = {
                    IconButton(onClick = { addMenuOpen = true }) {
                        Icon(Icons.Default.Add, "Import key")
                    }
                    DropdownMenu(expanded = addMenuOpen, onDismissRequest = { addMenuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Import key") },
                            onClick = { addMenuOpen = false; viewModel.onAction(KeysAction.AddClicked) },
                            leadingIcon = { Icon(Icons.Default.Key, "Import key") },
                        )
                        DropdownMenuItem(
                            text = { Text("Generate key") },
                            onClick = { addMenuOpen = false; viewModel.onAction(KeysAction.GenerateClicked) },
                            leadingIcon = { Icon(Icons.Default.Add, "Generate key") },
                        )
                    }
                },
            )
        },
        snackbarHost = {
            state.feedbackMessage?.let { message ->
                Snackbar(action = { TextButton(onClick = { viewModel.onAction(KeysAction.FeedbackDismissed) }) { Text("Dismiss") } }) { Text(message) }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onAction(KeysAction.QueryChanged(it)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, "Search keys") },
                placeholder = { Text("Search keys") },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = state.selectedType == null, onClick = { viewModel.onAction(KeysAction.TypeSelected(null)) }, label = { Text("All types") })
                KeyType.entries.forEach { type ->
                    FilterChip(selected = state.selectedType == type, onClick = { viewModel.onAction(KeysAction.TypeSelected(if (state.selectedType == type) null else type)) }, label = { Text(type.label) })
                }
            }
            if (state.isLoading) {
                androidx.compose.foundation.layout.Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (state.keys.isEmpty()) {
                EmptyKeys(onImport = { viewModel.onAction(KeysAction.AddClicked) }, onGenerate = { viewModel.onAction(KeysAction.GenerateClicked) })
            } else if (viewModel.visibleKeys.isEmpty()) {
                Text("No keys match your search.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(viewModel.visibleKeys, key = { it.id }) { key ->
                        KeyCard(
                            key = key,
                            onEdit = { viewModel.onAction(KeysAction.EditClicked(key)) },
                            onDuplicate = { viewModel.onAction(KeysAction.DuplicateClicked(key)) },
                            onDelete = { viewModel.onAction(KeysAction.DeleteClicked(key)) },
                        )
                    }
                }
            }
        }
    }
    state.pendingDelete?.let { key ->
        AlertDialog(onDismissRequest = viewModel::cancelDelete, title = { Text("Delete key") }, text = { Text("Delete ${key.name}? Hosts that reference it may need another key.") }, confirmButton = { TextButton(onClick = viewModel::confirmDelete) { Text("Delete") } }, dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Cancel") } })
    }
}

@Composable
private fun EmptyKeys(onImport: () -> Unit, onGenerate: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(bottom = 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Surface(Modifier.size(72.dp), CircleShape, color = MaterialTheme.colorScheme.primaryContainer) { Icon(Icons.Default.Key, "Keys", Modifier.padding(20.dp), tint = MaterialTheme.colorScheme.primary) }
        Text("No keys yet", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 18.dp))
        Text("Import an existing key or generate one to authenticate SSH hosts.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 20.dp)) {
            Button(onClick = onImport) { Text("Import key") }
            TextButton(onClick = onGenerate) { Text("Generate") }
        }
    }
}

@Composable
private fun KeyCard(key: KeyItem, onEdit: () -> Unit, onDuplicate: () -> Unit, onDelete: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(Modifier.size(46.dp), CircleShape, color = MaterialTheme.colorScheme.primaryContainer) { Text(key.name.take(1).uppercase(), Modifier.padding(13.dp), color = MaterialTheme.colorScheme.primary) }
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(key.name, style = MaterialTheme.typography.titleMedium)
                    if (key.passphrase.isNotEmpty()) Icon(Icons.Default.Lock, "Passphrase protected", Modifier.padding(start = 6.dp).size(16.dp))
                }
                Text("SHA256:${previewKey(key.publicKey)}", fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 6.dp)) {
                    AssistChip(onClick = {}, label = { Text(key.type.label) })
                    if (key.certificate.isNotEmpty()) AssistChip(onClick = {}, label = { Text("Certificate") })
                }
            }
            IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More actions for ${key.name}") }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(text = { Text("Edit") }, onClick = { menuOpen = false; onEdit() }, leadingIcon = { Icon(Icons.Default.Edit, "Edit key") })
                DropdownMenuItem(text = { Text("Duplicate") }, onClick = { menuOpen = false; onDuplicate() }, leadingIcon = { Icon(Icons.Default.ContentCopy, "Duplicate key") })
                DropdownMenuItem(text = { Text("Delete") }, onClick = { menuOpen = false; onDelete() }, leadingIcon = { Icon(Icons.Default.DeleteOutline, "Delete key") })
            }
        }
    }
}

private fun previewKey(publicKey: String): String {
    val value = publicKey.trim().split(" ").getOrNull(1) ?: publicKey.trim()
    return if (value.length <= 24) value else "${value.take(12)}...${value.takeLast(7)}"
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun KeyEditorPage(key: KeyItem?, onDismiss: () -> Unit, onSave: (KeyItem) -> Unit) {
    var name by remember(key) { mutableStateOf(key?.name.orEmpty()) }
    var publicKey by remember(key) { mutableStateOf(key?.publicKey.orEmpty()) }
    var privateKey by remember(key) { mutableStateOf(key?.privateKey.orEmpty()) }
    var passphrase by remember(key) { mutableStateOf(key?.passphrase.orEmpty()) }
    var showDiscard by remember { mutableStateOf(false) }
    val isDirty = name != key?.name.orEmpty() || publicKey != key?.publicKey.orEmpty() || privateKey != key?.privateKey.orEmpty() || passphrase != key?.passphrase.orEmpty()
    val requestDismiss = { if (isDirty) showDiscard = true else onDismiss() }
    BackHandler(onBack = requestDismiss)
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = requestDismiss) { Icon(Icons.Default.Close, "Close editor") } },
                title = { Text(if (key == null) "Import key" else "Edit key") },
                actions = { TextButton(enabled = name.isNotBlank() && publicKey.isNotBlank(), onClick = { onSave(KeyItem(key?.id ?: "key-${System.currentTimeMillis()}", name.trim(), inferType(publicKey), publicKey.trim(), privateKey, passphrase)) }) { Text("Save") } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Key information", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(publicKey, { publicKey = it }, label = { Text("Public key") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            Text("Private material", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
            OutlinedTextField(privateKey, { privateKey = it }, label = { Text("Private key") }, modifier = Modifier.fillMaxWidth(), minLines = 4)
            OutlinedTextField(passphrase, { passphrase = it }, label = { Text("Passphrase (optional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
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

private fun inferType(publicKey: String): KeyType = when {
    publicKey.contains("rsa", ignoreCase = true) -> KeyType.RSA
    publicKey.contains("ecdsa", ignoreCase = true) -> KeyType.ECDSA
    else -> KeyType.Ed25519
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun KeyGeneratorPage(onDismiss: () -> Unit, onGenerate: () -> Unit) {
    var name by remember { mutableStateOf("") }
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, "Close key generator") } },
                title = { Text("Generate key") },
                actions = { TextButton(enabled = name.isNotBlank(), onClick = onGenerate) { Text("Generate") } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Key details", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(name, { name = it }, label = { Text("Key name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            Text("The generated key will be available for SSH host authentication when Android key storage is connected.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
