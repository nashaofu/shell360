package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import com.nashaofu.shell360.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KnownHostScreen(repository: KnownHostRepository, onBack: () -> Unit, onOpenDrawer: (() -> Unit)? = null) {
    var items by remember { mutableStateOf(repository.getAll()) }
    var keyword by remember { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }
    var host by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("ssh-ed25519") }
    var key by remember { mutableStateOf("") }
    var detail by remember { mutableStateOf<NativeKnownHost?>(null) }
    var deleting by remember { mutableStateOf<NativeKnownHost?>(null) }
    val filtered = items.filter {
        keyword.isBlank() || listOf(it.host, it.type, it.key).any { value -> value.contains(keyword, ignoreCase = true) }
    }
    Scaffold(topBar = { NativeTopBar("Known Hosts", onBack = onBack, onOpenDrawer = onOpenDrawer) { IconButton(onClick = { adding = true }, modifier = Modifier.size(44.dp)) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_add), "Add known host", Modifier.size(20.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurface)) } } }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = ShellPagePadding)) {
            NativeCompactField(keyword, { keyword = it }, "Search hostname or fingerprint", leadingIconRes = R.drawable.ic_search, onClear = { keyword = "" }, fieldHeight = 48.dp)
            if (filtered.isEmpty()) {
                androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    ShellEmptyState(
                        title = if (items.isEmpty()) "No known hosts yet" else "No matching hosts",
                        message = if (items.isEmpty()) "Trusted fingerprints will appear here after verification." else "Try a different hostname or fingerprint.",
                        action = if (items.isEmpty()) "Add known host" else "Clear search",
                        onAction = { if (items.isEmpty()) adding = true else keyword = "" },
                    )
                }
            } else LazyColumn(Modifier.fillMaxWidth().weight(1f).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(filtered, key = { it.rawLine }) { item ->
                    ShellCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth().clickable { detail = item }.padding(14.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            androidx.compose.foundation.layout.Box(Modifier.size(40.dp).background(androidx.compose.material3.MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp)), contentAlignment = androidx.compose.ui.Alignment.Center) {
                                androidx.compose.foundation.Image(painterResource(R.drawable.ic_fingerprint), "Fingerprint", Modifier.size(20.dp), colorFilter = ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.onPrimaryContainer))
                            }
                            Column(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(item.host, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                                Text("${item.type}  ${fingerprint(item.key)}", style = androidx.compose.material3.MaterialTheme.typography.bodySmall.copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                            }
                            IconButton(onClick = { deleting = item }) {
                                androidx.compose.foundation.Image(painterResource(R.drawable.ic_delete), "Delete ${item.host}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant))
                            }
                        }
                    }
                }
            }
        }
    }
    deleting?.let { item ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete known host?") },
            text = { Text("The trusted fingerprint for ${item.host} will be removed from this device.") },
            confirmButton = { Button(onClick = { repository.delete(item); items = repository.getAll(); deleting = null }) { Text("Delete") } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }
    detail?.let { item ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { detail = null },
            title = { Text(item.host) },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Text("Key type: ${item.type}"); Text("Fingerprint", style = MaterialTheme.typography.labelLarge); Text(fingerprint(item.key), fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace); Text("Public key", style = MaterialTheme.typography.labelLarge); Text(item.key, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace) } },
            confirmButton = { androidx.compose.material3.TextButton(onClick = { detail = null }) { Text("Close") } },
        )
    }
    if (adding) {
        NativePageDrawer(
            onDismissRequest = { adding = false },
        ) {
            Column(Modifier.fillMaxWidth().fillMaxHeight().padding(horizontal = 16.dp)) {
                Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Add known host", style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp), modifier = Modifier.weight(1f))
                    IconButton(onClick = { adding = false }) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_close), "Close add known host", Modifier.size(20.dp)) }
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Host", style = MaterialTheme.typography.labelLarge)
                    NativeCompactField(host, { host = it }, "Host or [host]:port")
                    Text("Key type", style = MaterialTheme.typography.labelLarge)
                    NativeCompactField(type, { type = it }, "Key type")
                    Text("Public key", style = MaterialTheme.typography.labelLarge)
                    OutlinedTextField(key, { key = it }, Modifier.fillMaxWidth(), minLines = 3, label = { Text("Public key") })
                }
                    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { adding = false }, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Cancel") }
                        Button(onClick = {
                runCatching { repository.add(host.trim(), type.trim(), key.trim()) }
                    .onSuccess { items = repository.getAll(); host = ""; key = ""; adding = false }
                        }, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Add") }
                    }
            }
        }
    }
}

private fun fingerprint(value: String): String = if (value.length > 20) "${value.take(12)}…${value.takeLast(4)}" else value
