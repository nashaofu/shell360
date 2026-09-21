package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import com.nashaofu.shell360.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeyScreen(repository: KeyRepository, hostRepository: HostRepository? = null, onBack: () -> Unit, onOpenDrawer: (() -> Unit)? = null) {
    var keys by remember { mutableStateOf<List<NativeKey>>(emptyList()) }
    var editing by remember { mutableStateOf<NativeKey?>(null) }
    var generating by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<NativeKey?>(null) }
    var keyMenuExpanded by remember { mutableStateOf(false) }
    var filterMenuExpanded by remember { mutableStateOf(false) }
    var keyword by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf<String?>(null) }
    var hosts by remember { mutableStateOf<List<NativeHost>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    fun refresh() {
        loading = true
        loadError = null
        repository.getAll { result ->
            result.onSuccess { value -> keys = value }
                .onFailure { loadError = it.message ?: "Unable to load keys" }
            loading = false
        }
    }
    LaunchedEffect(Unit) { refresh() }
    LaunchedEffect(hostRepository) { hostRepository?.getAll { it.onSuccess { hosts = it } } }
    deleting?.let { key ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete key?") },
            text = {
                val affectedHosts = hosts.filter { it.keyId == key.id }
                Text(
                    if (affectedHosts.isEmpty()) "This key will be removed from this device."
                    else "This key is used by: ${affectedHosts.joinToString { it.name.ifBlank { it.hostname } }}. It will be removed from this device.",
                )
            },
            confirmButton = {
                Button(onClick = {
                    repository.delete(key) { refresh() }
                    deleting = null
                }) { Text("Delete") }
            },
            dismissButton = { Button(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }
    if (editing != null) {
        KeyEditor(editing!!, repository, { editing = null }) { editing = null; refresh() }
    }
    Scaffold(
        topBar = {
            NativeTopBar("Keys", onBack = onBack, onOpenDrawer = onOpenDrawer) {
                androidx.compose.foundation.layout.Box {
                    IconButton(onClick = { keyMenuExpanded = true }, modifier = androidx.compose.ui.Modifier.size(44.dp)) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_add), "Add or import key", Modifier.size(20.dp)) }
                    DropdownMenu(expanded = keyMenuExpanded, onDismissRequest = { keyMenuExpanded = false }) {
                        DropdownMenuItem(text = { Text("Import key") }, onClick = { keyMenuExpanded = false; editing = NativeKey() })
                        DropdownMenuItem(text = { Text("Generate key") }, onClick = { keyMenuExpanded = false; generating = true })
                    }
                }
            }
        },
    ) { padding ->
        val filteredKeys = keys.filter { key ->
            val query = keyword.trim().lowercase()
            (selectedType == null || keyType(key.publicKey) == selectedType) &&
                (query.isEmpty() || key.name.lowercase().contains(query) || key.publicKey.lowercase().contains(query))
        }
        if (loading) {
            androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                androidx.compose.material3.CircularProgressIndicator()
            }
        } else if (loadError != null) {
            androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().padding(padding).padding(horizontal = ShellPagePadding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Unable to load keys", style = MaterialTheme.typography.titleMedium)
                    Text(loadError.orEmpty(), color = MaterialTheme.colorScheme.error)
                    Button(onClick = ::refresh) { Text("Retry") }
                }
            }
        } else LazyColumn(Modifier.fillMaxSize().padding(padding).padding(horizontal = ShellPagePadding), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                NativeCompactField(keyword, { keyword = it }, "Search keys", leadingIconRes = R.drawable.ic_search, onClear = { keyword = "" }, fieldHeight = 48.dp)
            }
            item {
                androidx.compose.foundation.layout.Box {
                    Button(
                        onClick = { filterMenuExpanded = true },
                        modifier = Modifier.height(40.dp),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant, contentColor = androidx.compose.material3.MaterialTheme.colorScheme.onSurface),
                    ) { Text(selectedType ?: "All types", fontSize = 13.sp) }
                    DropdownMenu(expanded = filterMenuExpanded, onDismissRequest = { filterMenuExpanded = false }) {
                        listOf<String?>(null, "Ed25519", "RSA", "ECDSA").forEach { type ->
                            DropdownMenuItem(text = { Text(type ?: "All types") }, onClick = { selectedType = type; filterMenuExpanded = false })
                        }
                    }
                }
            }
            if (filteredKeys.isEmpty()) {
                item {
                    ShellEmptyState(
                        title = if (keys.isEmpty()) "No keys yet" else "No matching keys",
                        message = if (keys.isEmpty()) "Add or generate a key to authenticate securely." else "Try a different name or key type.",
                        action = if (keys.isEmpty()) "Add key" else "Clear filters",
                        onAction = { if (keys.isEmpty()) editing = NativeKey() else { keyword = ""; selectedType = null } },
                    )
                }
            }
            items(filteredKeys, key = { it.id }) { key ->
                ShellCard(Modifier.fillMaxWidth().clickable { editing = key }) {
                    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.foundation.layout.Box(
                            Modifier.size(40.dp).background(androidx.compose.material3.MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center,
                        ) { Text(key.name.ifBlank { "K" }.take(1).uppercase(), color = androidx.compose.material3.MaterialTheme.colorScheme.onPrimaryContainer) }
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(key.name.ifBlank { "Unnamed key" }, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                            Text(keyPreview(key.publicKey), style = androidx.compose.material3.MaterialTheme.typography.bodySmall.copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        }
                        Text(keyType(key.publicKey), fontSize = 11.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, color = androidx.compose.material3.MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.background(androidx.compose.material3.MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 1.dp))
                        IconButton(onClick = { deleting = key }) {
                            androidx.compose.foundation.Image(painterResource(R.drawable.ic_delete), "Delete ${key.name.ifBlank { "unnamed key" }}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant))
                        }
                    }
                }
            }
        }
    }
    if (generating) GenerateKeyDialog(repository, { generating = false; refresh() }, { generating = false })
}

@Composable
private fun GenerateKeyDialog(repository: KeyRepository, onDone: () -> Unit, onCancel: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("Ed25519") }
    var bits by remember { mutableStateOf("2048") }
    var curve by remember { mutableStateOf("NistP256") }
    var passphrase by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    AlertDialog(onDismissRequest = onCancel, title = { Text("Generate key") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            NativeCompactField(name, { name = it }, "Name", fieldHeight = 40.dp)
            androidx.compose.foundation.layout.Box {
                OutlinedTextField(type, {}, placeholder = { Text("Algorithm") }, readOnly = true, modifier = Modifier.fillMaxWidth().height(40.dp).clickable { expanded = true })
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    listOf("Ed25519", "Rsa", "Ecdsa").forEach { option -> DropdownMenuItem(text = { Text(option) }, onClick = { type = option; expanded = false }) }
                }
            }
            if (type == "Rsa") NativeCompactField(bits, { bits = it }, "Bit size (2048 or 4096)", fieldHeight = 40.dp)
            if (type == "Ecdsa") NativeCompactField(curve, { curve = it }, "Curve (NistP256/NistP384/NistP521)", fieldHeight = 40.dp)
            NativeCompactField(passphrase, { passphrase = it }, "Passphrase (optional)", password = true, fieldHeight = 40.dp)
            if (error.isNotBlank()) Text(error, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
        }
    }, confirmButton = { Button(onClick = {
        if (name.isBlank()) { error = "Name is required"; return@Button }
        val bitSize = if (type == "Rsa") bits.toIntOrNull() else null
        if (type == "Rsa" && bitSize !in listOf(2048, 4096)) { error = "Bit size must be 2048 or 4096"; return@Button }
        repository.generate(type, bitSize, if (type == "Ecdsa") curve else null, passphrase) { result ->
            result.onSuccess { generated -> repository.save(generated.copy(name = name)) { saved -> saved.onSuccess { onDone() }.onFailure { error = it.message ?: "Unable to save key" } } }.onFailure { error = it.message ?: "Unable to generate key" }
        }
    }) { Text("Generate") } }, dismissButton = { Button(onClick = onCancel) { Text("Cancel") } })
}

private fun keyType(publicKey: String): String = when (publicKey.trim().split(Regex("\\s+")).firstOrNull()) {
    "ssh-ed25519", "sk-ssh-ed25519@openssh.com" -> "Ed25519"
    "ssh-rsa", "ssh-rsa-cert-v01@openssh.com" -> "RSA"
    "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521" -> "ECDSA"
    else -> "Key"
}

private fun keyPreview(publicKey: String): String {
    val value = publicKey.trim().split(Regex("\\s+")).getOrNull(1).orEmpty()
    return if (value.isBlank()) "Private key only" else "SHA256:${value.take(12)}…${value.takeLast(7)}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun KeyEditor(initial: NativeKey, repository: KeyRepository, onCancel: () -> Unit, onSaved: () -> Unit) {
    var key by remember(initial) { mutableStateOf(initial) }
    var error by remember(initial) { mutableStateOf("") }
    val context = LocalContext.current
    var importTarget by remember { mutableStateOf("private") }
    val importPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.openInputStream(uri).use { stream ->
                    requireNotNull(stream) { "Unable to open selected key file." }
                    stream.bufferedReader().readText()
                }
            }.onSuccess { content ->
                key = when (importTarget) {
                    "public" -> key.copy(publicKey = content)
                    "certificate" -> key.copy(certificate = content)
                    else -> key.copy(privateKey = content)
                }
            }
        }
    }
    NativePageDrawer(
        onDismissRequest = onCancel,
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight().padding(horizontal = 16.dp)) {
            Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (initial.id.isEmpty()) "Add key" else "Edit key", style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp), modifier = Modifier.weight(1f))
                IconButton(onClick = onCancel) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_close), "Close key editor", Modifier.size(20.dp), colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)) }
            }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Name", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(key.name, { key = key.copy(name = it) }, "Name")
            Text("Private key", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            OutlinedTextField(key.privateKey, { key = key.copy(privateKey = it) }, Modifier.fillMaxWidth(), minLines = 5, label = { Text("Private key") }, visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation())
            Button(onClick = { importTarget = "private"; importPicker.launch(arrayOf("text/*", "application/octet-stream", "*/*")) }) { Text("Import private key") }
            Text("Public key", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            OutlinedTextField(key.publicKey, { key = key.copy(publicKey = it) }, Modifier.fillMaxWidth(), minLines = 3, label = { Text("Public key") })
            Button(onClick = { importTarget = "public"; importPicker.launch(arrayOf("text/*", "*/*")) }) { Text("Import public key") }
            Text("Passphrase", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(key.passphrase, { key = key.copy(passphrase = it) }, "Passphrase", password = true)
            Text("Certificate", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            OutlinedTextField(key.certificate, { key = key.copy(certificate = it) }, Modifier.fillMaxWidth(), minLines = 3, label = { Text("Certificate") })
            Button(onClick = { importTarget = "certificate"; importPicker.launch(arrayOf("text/*", "*/*")) }) { Text("Import certificate") }
            if (error.isNotBlank()) Text(error, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            }
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = onCancel, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Cancel") }
                Button(onClick = {
                    error = ""
                    repository.save(key) { result ->
                        result.onSuccess { onSaved() }.onFailure { error = it.message ?: "Unable to save key" }
                    }
                }, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Save") }
            }
        }
    }
}
