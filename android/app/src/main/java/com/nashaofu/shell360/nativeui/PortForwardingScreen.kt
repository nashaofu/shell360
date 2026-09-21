package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.background
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.BorderStroke
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nashaofu.shell360.terminal.NativeRuntimeClient
import org.json.JSONObject
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import com.nashaofu.shell360.R

enum class NativeForwardType { Local, Remote, Dynamic }

data class NativeForward(
    val id: String = "", val name: String = "", val type: NativeForwardType = NativeForwardType.Local,
    val hostId: String = "", val localAddress: String = "127.0.0.1", val localPort: Int = 0,
    val remoteAddress: String = "127.0.0.1", val remotePort: Int = 0,
) {
    fun json(includeId: Boolean) = JSONObject().apply {
        if (includeId) put("id", id)
        put("name", name).put("portForwardingType", type.name)
        hostId.toLongOrNull()?.let { put("hostId", it) }
        put("localAddress", localAddress).put("localPort", localPort)
            .put("remoteAddress", remoteAddress).put("remotePort", remotePort)
    }
    companion object { fun fromJson(v: JSONObject) = NativeForward(v.optString("id"), v.optString("name"), runCatching { NativeForwardType.valueOf(v.optString("portForwardingType")) }.getOrDefault(NativeForwardType.Local), v.optString("hostId"), v.optString("localAddress", "127.0.0.1"), v.optInt("localPort"), v.optString("remoteAddress", "127.0.0.1"), v.optInt("remotePort")) }
}

class PortForwardingRepository(private val runtime: NativeRuntimeClient) {
    fun all(done: (List<NativeForward>) -> Unit) = runtime.request("data.getPortForwardings") { r ->
        val data = r.optJSONArray("data") ?: return@request done(emptyList())
        done(buildList { for (i in 0 until data.length()) add(NativeForward.fromJson(data.getJSONObject(i))) })
    }
    fun save(item: NativeForward, done: (Result<Unit>) -> Unit) = runtime.request(if (item.id.isEmpty()) "data.addPortForwarding" else "data.updatePortForwarding", item.json(item.id.isNotEmpty())) { response -> done(response.result()) }
    fun delete(item: NativeForward, done: (Result<Unit>) -> Unit) = runtime.request("data.deletePortForwarding", item.json(true)) { response -> done(response.result()) }
    fun open(session: NativeSshSession, item: NativeForward, forwardingId: String = java.util.UUID.randomUUID().toString(), done: (Result<Unit>) -> Unit) {
        val method = when (item.type) { NativeForwardType.Local -> "ssh.portForwarding.openLocal"; NativeForwardType.Remote -> "ssh.portForwarding.openRemote"; NativeForwardType.Dynamic -> "ssh.portForwarding.openDynamic" }
        val data = item.json(false).put("sshSessionId", session.id).put("sshPortForwardingId", forwardingId)
        runtime.request(method, data) { r -> done(r.result()) }
    }
    fun close(session: NativeSshSession, item: NativeForward, forwardingId: String, done: (Result<Unit>) -> Unit) {
        val method = when (item.type) { NativeForwardType.Local -> "ssh.portForwarding.closeLocal"; NativeForwardType.Remote -> "ssh.portForwarding.closeRemote"; NativeForwardType.Dynamic -> "ssh.portForwarding.closeDynamic" }
        runtime.request(method, JSONObject().put("sshSessionId", session.id).put("sshPortForwardingId", forwardingId)) { done(it.result()) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortForwardingScreen(repository: PortForwardingRepository, hostRepository: HostRepository, onBack: () -> Unit, onOpenDrawer: (() -> Unit)? = null, session: NativeSshSession? = null) {
    var items by remember { mutableStateOf<List<NativeForward>>(emptyList()) }
    var hosts by remember { mutableStateOf<List<NativeHost>>(emptyList()) }
    var editing by remember { mutableStateOf<NativeForward?>(null) }
    var deleting by remember { mutableStateOf<NativeForward?>(null) }
    var active by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var statuses by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var keyword by remember { mutableStateOf("") }
    fun refresh() {
        loading = true
        repository.all {
            items = it
            loading = false
        }
    }
    LaunchedEffect(Unit) {
        refresh()
        hostRepository.getAll { result -> result.onSuccess { hosts = it } }
    }
    deleting?.let { item ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete port forwarding?") },
            text = { Text("This port forwarding configuration will be removed from this device.") },
            confirmButton = {
                Button(onClick = {
                    repository.delete(item) { result -> result.onSuccess { refresh() } }
                    deleting = null
                }) { Text("Delete") }
            },
            dismissButton = { Button(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }
    if (editing != null) { ForwardEditor(editing!!, hosts, repository, { editing = null }, { error = it }) { editing = null; refresh() } }
    val filteredItems = items.filter { item ->
        val query = keyword.trim().lowercase()
        query.isEmpty() || listOf(item.name, item.type.name, item.localAddress, item.remoteAddress).any { it.lowercase().contains(query) }
    }
    val activeItems = filteredItems.filter { statuses[it.id] in setOf("Connecting", "Running") }
    val inactiveItems = filteredItems.filterNot { statuses[it.id] in setOf("Connecting", "Running") }
    Scaffold(
        topBar = { NativeTopBar("Port Forwarding", onBack = onBack, onOpenDrawer = onOpenDrawer) { IconButton(onClick = { editing = NativeForward() }, modifier = Modifier.size(44.dp)) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_add), "Add port forwarding", Modifier.size(20.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurface)) } } },
    ) { p ->
            if (loading) {
                Box(Modifier.fillMaxSize().padding(p), contentAlignment = Alignment.Center) {
                    androidx.compose.material3.CircularProgressIndicator()
                }
            } else LazyColumn(Modifier.fillMaxSize().padding(p).padding(horizontal = ShellPagePadding), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    NativeCompactField(keyword, { keyword = it }, "Search port forwarding", leadingIconRes = R.drawable.ic_search, onClear = { keyword = "" }, fieldHeight = 48.dp)
                }
                item { if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error) }
                if (filteredItems.isEmpty()) {
                    item {
                        ShellEmptyState(
                            title = if (items.isEmpty()) "No port forwarding rules yet" else "No matching port forwarding rules",
                            message = if (items.isEmpty()) "Create a port forwarding rule for an active SSH session." else "Try a different rule name or address.",
                            action = if (items.isEmpty()) "Add port forwarding" else "Clear search",
                            onAction = { if (items.isEmpty()) editing = NativeForward() else keyword = "" },
                        )
                    }
                }
                if (activeItems.isNotEmpty()) item { Text("Active", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)) }
                items(activeItems, key = { it.id }) { item -> ForwardCard(item, statuses[item.id] ?: "Running", session, active, repository, { active = it }, { statuses = statuses + (item.id to it) }, { editing = item }, { error = it }, { deleting = item }, ::refresh) }
                if (inactiveItems.isNotEmpty()) item { Text("Stopped or disconnected", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)) }
                items(inactiveItems, key = { it.id }) { item -> ForwardCard(item, statuses[item.id] ?: "Stopped", session, active, repository, { active = it }, { statuses = statuses + (item.id to it) }, { editing = item }, { error = it }, { deleting = item }, ::refresh) }
            }
    }
}

@Composable
private fun ForwardCard(item: NativeForward, state: String, session: NativeSshSession?, active: Map<String, String>, repository: PortForwardingRepository, setActive: (Map<String, String>) -> Unit, setStatus: (String) -> Unit, edit: () -> Unit, setError: (String) -> Unit, requestDelete: () -> Unit, refresh: () -> Unit) {
    ShellCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp)),
                    contentAlignment = androidx.compose.ui.Alignment.Center,
                ) { Text(item.type.name.take(1), color = MaterialTheme.colorScheme.onPrimaryContainer, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) }
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(item.name.ifBlank { "Unnamed port forwarding" }, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                    Text("${item.type}: ${item.localAddress}:${item.localPort} → ${item.remoteAddress}:${item.remotePort}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                val stateIcon = when (state) {
                    "Running" -> R.drawable.ic_workspace
                    "Connecting" -> R.drawable.ic_refresh
                    "Error" -> R.drawable.ic_fingerprint
                    "Disconnected" -> R.drawable.ic_close
                    else -> R.drawable.ic_stop
                }
                Row(
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    modifier = Modifier.background(if (state == "Running") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    androidx.compose.foundation.Image(
                        painterResource(stateIcon),
                        "$state port forwarding status",
                        Modifier.padding(end = 4.dp).size(14.dp),
                        colorFilter = ColorFilter.tint(if (state == "Error") MaterialTheme.colorScheme.error else if (state == "Running") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant),
                    )
                    Text(state, color = if (state == "Error") MaterialTheme.colorScheme.error else if (state == "Running") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = edit, modifier = Modifier.weight(1f).height(44.dp), shape = RoundedCornerShape(10.dp)) { Text("Edit", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                Button(enabled = session != null && state != "Running" && state != "Connecting", onClick = { session?.let { ssh -> setStatus("Connecting"); val id = java.util.UUID.randomUUID().toString(); repository.open(ssh, item, id) { result -> result.onSuccess { setActive(active + (item.id to id)); setStatus("Running") }.onFailure { setStatus("Error"); setError(it.message ?: "Start failed") } } } }, modifier = Modifier.weight(1f).height(44.dp), shape = RoundedCornerShape(10.dp)) { Text(if (state == "Connecting") "Connecting…" else "Start", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                IconButton(enabled = session != null && state == "Running", onClick = { session?.let { ssh -> setStatus("Disconnected"); repository.close(ssh, item, active[item.id].orEmpty()) { result -> result.onSuccess { setActive(active - item.id) }.onFailure { setStatus("Error"); setError(it.message ?: "Stop failed") } } } }) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_stop), "Stop ${item.name.ifBlank { "unnamed port forwarding" }}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.error)) }
                IconButton(onClick = requestDelete) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_delete), "Delete ${item.name.ifBlank { "unnamed port forwarding" }}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant)) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ForwardEditor(initial: NativeForward, hosts: List<NativeHost>, repository: PortForwardingRepository, cancel: () -> Unit, failed: (String) -> Unit, saved: () -> Unit) {
    var item by remember(initial) { mutableStateOf(initial) }
    NativePageDrawer(
        onDismissRequest = cancel,
    ) { Column(Modifier.fillMaxWidth().fillMaxHeight().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Port forwarding", style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp), modifier = Modifier.weight(1f))
            IconButton(onClick = cancel) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_close), "Close port forwarding editor", Modifier.size(20.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant)) }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Name", style = MaterialTheme.typography.labelLarge)
        NativeCompactField(item.name, { item = item.copy(name = it) }, "Name")
        var hostExpanded by remember { mutableStateOf(false) }
        Text("Host", style = MaterialTheme.typography.labelLarge)
        Box {
            OutlinedTextField(
                value = hosts.firstOrNull { it.id == item.hostId }?.let { "${it.name.ifBlank { it.hostname }} (${it.username}@${it.hostname})" } ?: "Select a saved host",
                onValueChange = {},
                modifier = Modifier.fillMaxWidth().height(40.dp).clickable { hostExpanded = true },
                placeholder = { Text("Host") },
                readOnly = true,
            )
            Box(Modifier.matchParentSize().clickable { hostExpanded = true })
            DropdownMenu(expanded = hostExpanded, onDismissRequest = { hostExpanded = false }, modifier = Modifier.fillMaxWidth(0.9f)) {
                hosts.forEach { host ->
                    DropdownMenuItem(
                        text = { Text(host.name.ifBlank { host.hostname }) },
                        onClick = { item = item.copy(hostId = host.id); hostExpanded = false },
                    )
                }
            }
        }
        var typeExpanded by remember { mutableStateOf(false) }
        Text("Forwarding type", style = MaterialTheme.typography.labelLarge)
        Box {
            OutlinedTextField(
                value = item.type.name,
                onValueChange = {},
                modifier = Modifier.fillMaxWidth().height(40.dp).clickable { typeExpanded = true },
                placeholder = { Text("Forwarding type") },
                readOnly = true,
            )
            Box(Modifier.matchParentSize().clickable { typeExpanded = true })
            DropdownMenu(expanded = typeExpanded, onDismissRequest = { typeExpanded = false }, modifier = Modifier.fillMaxWidth(0.9f)) {
                NativeForwardType.entries.forEach { type ->
                    DropdownMenuItem(text = { Text(type.name) }, onClick = { item = item.copy(type = type); typeExpanded = false })
                }
            }
        }
        Text("Local address", style = MaterialTheme.typography.labelLarge)
        NativeCompactField(item.localAddress, { item = item.copy(localAddress = it) }, "Local address")
        Text("Local port", style = MaterialTheme.typography.labelLarge)
        NativeCompactField(item.localPort.toString(), { value -> value.toIntOrNull()?.let { n -> item = item.copy(localPort = n) } }, "Local port")
        Text("Remote address", style = MaterialTheme.typography.labelLarge)
        NativeCompactField(item.remoteAddress, { item = item.copy(remoteAddress = it) }, "Remote address")
        Text("Remote port", style = MaterialTheme.typography.labelLarge)
        NativeCompactField(item.remotePort.toString(), { value -> value.toIntOrNull()?.let { n -> item = item.copy(remotePort = n) } }, "Remote port")
        }
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(cancel, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Cancel") }
            Button(onClick = {
                if (item.name.isBlank() || item.hostId.toLongOrNull() == null || item.localPort !in 1..65535 ||
                    (item.type != NativeForwardType.Dynamic && item.remotePort !in 1..65535)
                ) return@Button
                repository.save(item) { result -> result.onSuccess { saved() }.onFailure { failed(it.message ?: "Save failed") } }
            }, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) { Text("Save") }
        }
    } }
}
