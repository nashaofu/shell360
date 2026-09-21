package com.nashaofu.shell360.nativeui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Card
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.FilterChip
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import kotlinx.coroutines.launch
import com.nashaofu.shell360.R
import com.nashaofu.shell360.ui.theme.mobileFrame

data class NativeWorkspaceSession(
    val id: String,
    val hostId: String,
    val title: String,
    val type: String,
    val state: String = "Connected",
    val errorMessage: String? = null,
    val createdAt: Long = 0L,
    val lastActiveAt: Long = createdAt,
)

@OptIn(ExperimentalMaterial3Api::class)
@androidx.compose.runtime.Composable
fun HostScreen(repository: HostRepository, keys: List<NativeKey> = emptyList(), openDrawerRequest: Int = 0, selectedRoute: Int = 0, drawerOnly: Boolean = false, activeSessionCount: Int = 0, editHostRequest: String? = null, onEditHostRequestConsumed: () -> Unit = {}, onOpenHosts: () -> Unit = {}, onOpenWorkspace: () -> Unit = {}, onOpenKeys: () -> Unit = {}, onOpenKnownHosts: () -> Unit = {}, onOpenPortForwardings: () -> Unit = {}, onOpenSettings: () -> Unit = {}, onConnect: (NativeHost) -> Unit = {}, onOpenSftp: (NativeHost) -> Unit = {}) {
    var hosts by remember { mutableStateOf<List<NativeHost>>(emptyList()) }
    var editing by remember { mutableStateOf<NativeHost?>(null) }
    var hostMenu by remember { mutableStateOf<NativeHost?>(null) }
    var deleting by remember { mutableStateOf<NativeHost?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf("") }
    var keyword by remember { mutableStateOf("") }
    var selectedTag by remember { mutableStateOf<String?>(null) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val drawerScope = rememberCoroutineScope()
    var handledDrawerRequest by remember { mutableStateOf(openDrawerRequest) }
    BackHandler(enabled = drawerState.isOpen) {
        drawerScope.launch { drawerState.close() }
    }
    LaunchedEffect(openDrawerRequest) {
        if (openDrawerRequest > handledDrawerRequest) {
            handledDrawerRequest = openDrawerRequest
            drawerState.open()
        }
    }

    fun refresh() {
        loading = true
        loadError = ""
        repository.getAll { result ->
            result.onSuccess { hosts = it }
                .onFailure { loadError = it.message ?: "Unable to load hosts" }
            loading = false
        }
    }
    LaunchedEffect(Unit) { refresh() }
    LaunchedEffect(editHostRequest, hosts) {
        editHostRequest?.let { id ->
            hosts.firstOrNull { it.id == id }?.let {
                editing = it
                onEditHostRequestConsumed()
            }
        }
    }

    if (deleting != null) {
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete host?") },
            text = { Text("This host will be removed from this device.") },
            confirmButton = {
                Button(onClick = {
                    val target = deleting ?: return@Button
                    repository.delete(target) { result ->
                        result.onSuccess { refresh() }
                    }
                    deleting = null
                }) { Text("Delete") }
            },
            dismissButton = { Button(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
                ModalDrawerSheet(
                modifier = Modifier.fillMaxWidth(0.84f),
                drawerContainerColor = MaterialTheme.colorScheme.mobileFrame,
                        ) {
                Column(Modifier.fillMaxSize().padding(top = 18.dp, bottom = 12.dp)) {
                    Row(
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 22.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Image(
                            painter = painterResource(R.drawable.shell360_logo),
                            contentDescription = null,
                            modifier = Modifier.size(52.dp),
                        )
                        Column {
                            Text("Shell360", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold))
                            Text("SSH & SFTP Client", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    ShellSectionLabel("Workspace", Modifier.padding(horizontal = 24.dp, vertical = 12.dp))
                    DrawerItem(R.drawable.ic_workspace, "Workspace", supportingText = if (activeSessionCount > 0) "$activeSessionCount active sessions" else "No active sessions", selected = selectedRoute == 9, prominent = true) { drawerScope.launch { drawerState.close(); onOpenWorkspace() } }
                    androidx.compose.foundation.layout.Spacer(Modifier.height(16.dp))
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().padding(horizontal = 24.dp).height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
                    ShellSectionLabel("Resources", Modifier.padding(horizontal = 24.dp, vertical = 18.dp))
                    DrawerItem(R.drawable.ic_host, "Hosts", selected = selectedRoute == 0, prominent = false) { drawerScope.launch { drawerState.close(); onOpenHosts() } }
                    DrawerItem(R.drawable.ic_tunnel, "Port Forwarding") { drawerScope.launch { drawerState.close(); onOpenPortForwardings() } }
                    DrawerItem(R.drawable.ic_key, "Keys") { drawerScope.launch { drawerState.close(); onOpenKeys() } }
                    DrawerItem(R.drawable.ic_fingerprint, "Known Hosts") { drawerScope.launch { drawerState.close(); onOpenKnownHosts() } }
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
                    DrawerItem(R.drawable.ic_settings, "Settings") { drawerScope.launch { drawerState.close(); onOpenSettings() } }
                }
            }
        },
    ) {
    if (!drawerOnly) Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            NativeTopBar(
                title = "Hosts",
                onOpenDrawer = { drawerScope.launch { drawerState.open() } },
                actions = {
                    IconButton(onClick = { editing = NativeHost() }, modifier = Modifier.size(44.dp)) {
                        androidx.compose.foundation.Image(
                            painter = painterResource(R.drawable.ic_add),
                            contentDescription = "Add host",
                            modifier = Modifier.size(20.dp),
                            colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurface),
                        )
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 12.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                androidx.compose.foundation.text.BasicTextField(
                    value = keyword,
                    onValueChange = { keyword = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp),
                    singleLine = true,
                    textStyle = TextStyle(
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = MaterialTheme.typography.bodyMedium.fontSize,
                    ),
                    decorationBox = { innerTextField ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            androidx.compose.foundation.Image(painterResource(R.drawable.ic_search), null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant))
                            androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))
                            if (keyword.isEmpty()) Text("Search hosts", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            innerTextField()
                            if (keyword.isNotEmpty()) {
                                Text(
                                    "×",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.clickable { keyword = "" },
                                )
                            }
                        }
                    },
                )
            }
            item {
                val tags = hosts.flatMap { it.tags }.distinct().sorted()
                if (tags.isNotEmpty()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FilterChip(
                            label = "All",
                            selected = selectedTag == null,
                            onClick = { selectedTag = null },
                        )
                        tags.forEach { tag ->
                            FilterChip(tag, selectedTag == tag, onClick = { selectedTag = if (selectedTag == tag) null else tag })
                        }
                    }
                }
            }
            if (loading) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(top = 56.dp, bottom = 56.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        androidx.compose.material3.CircularProgressIndicator(
                            modifier = Modifier.size(28.dp),
                            strokeWidth = 3.dp,
                        )
                        Text("Loading hosts…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else if (loadError.isNotBlank()) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text("Unable to load hosts", style = MaterialTheme.typography.titleMedium)
                        Text(loadError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick = ::refresh, modifier = Modifier.height(44.dp), shape = RoundedCornerShape(12.dp)) {
                            Text("Retry")
                        }
                    }
                }
            } else if (hosts.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        androidx.compose.foundation.Image(
                            painter = painterResource(R.drawable.ic_host),
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant),
                        )
                        Text("There is no host yet, add it now.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Button(onClick = { editing = NativeHost() }, modifier = Modifier.height(48.dp), shape = RoundedCornerShape(12.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp)) { Text("＋  New Host", fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                    }
                }
            } else if (hosts.isNotEmpty() && hosts.none { host ->
            val query = keyword.trim().lowercase()
                (selectedTag == null || selectedTag in host.tags) &&
                    (query.isEmpty() || (listOf(host.name, host.hostname, host.username) + host.tags).any { it.lowercase().contains(query) })
            }) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text("No hosts match your search.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Button(onClick = { keyword = ""; selectedTag = null }, modifier = Modifier.height(48.dp), shape = RoundedCornerShape(12.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp)) { Text("Clear search", fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                    }
                }
            }
            items(hosts.filter { host ->
                val query = keyword.trim().lowercase()
                (selectedTag == null || selectedTag in host.tags) &&
                    (query.isEmpty() || (listOf(host.name, host.hostname, host.username) + host.tags).any { it.lowercase().contains(query) })
            }, key = { it.id }) { host ->
                ShellCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier.size(40.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center,
                            ) { Text(host.name.ifBlank { host.hostname }.take(1).uppercase(), color = MaterialTheme.colorScheme.primary, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(host.name.ifBlank { host.hostname }, fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, maxLines = 1)
                                    Box(
                                        Modifier.size(8.dp)
                                            .background(MaterialTheme.colorScheme.onSurfaceVariant, androidx.compose.foundation.shape.CircleShape),
                                    )
                                }
                                Text(
                                    "${host.username}@${host.hostname}:${host.port}",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                if (host.tags.isNotEmpty()) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        host.tags.take(3).forEach { tag ->
                                            Text(
                                                tag,
                                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                                style = MaterialTheme.typography.labelSmall,
                                                modifier = Modifier
                                                    .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp))
                                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                            )
                                        }
                                    }
                                }
                            }
                            Box {
                                IconButton(onClick = { hostMenu = host }) {
                                    androidx.compose.foundation.Image(
                                        painter = painterResource(R.drawable.ic_more),
                                        contentDescription = "More actions",
                                        modifier = Modifier.size(18.dp),
                                        colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant),
                                    )
                                }
                                DropdownMenu(
                                    expanded = hostMenu?.id == host.id,
                                    onDismissRequest = { hostMenu = null },
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("Edit") },
                                        onClick = { hostMenu = null; editing = host },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Duplicate") },
                                        onClick = {
                                            hostMenu = null
                                            editing = host.copy(id = "", name = "${host.name} Copy")
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Delete") },
                                        onClick = { hostMenu = null; deleting = host },
                                    )
                                }
                            }
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                modifier = Modifier.weight(1f).height(36.dp),
                                onClick = { onConnect(host) },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                ),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
                            ) { Text("SSH", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                            Button(
                                modifier = Modifier.weight(1f).height(36.dp),
                                onClick = { onOpenSftp(host) },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface,
                                ),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
                            ) { Text("SFTP", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold) }
                        }
                    }
                }
            }
        }
    } else {
        Box(Modifier.fillMaxSize())
    }
    }
    AnimatedVisibility(
        visible = !drawerOnly && editing != null,
        enter = slideInHorizontally(initialOffsetX = { it }) + fadeIn(),
        exit = slideOutHorizontally(targetOffsetX = { it }) + fadeOut(),
    ) {
        HostEditor(
            initial = editing ?: NativeHost(),
            keys = keys,
            onCancel = { editing = null },
            onSaved = { editing = null; refresh() },
            onSavedAndConnect = { saved -> editing = null; refresh(); onConnect(saved) },
            repository = repository,
        )
    }
}

@Composable
private fun DrawerItem(
    icon: Int,
    label: String,
    supportingText: String? = null,
    selected: Boolean = false,
    prominent: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(if (prominent) 68.dp else 58.dp)
            .padding(horizontal = if (prominent) 16.dp else 0.dp)
            .background(
                if (selected || prominent) {
                    if (prominent && !selected) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.primaryContainer
                } else androidx.compose.ui.graphics.Color.Transparent,
                RoundedCornerShape(if (prominent) 22.dp else 18.dp),
            )
            .then(
                if (prominent) Modifier.border(1.5.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(22.dp))
                else Modifier,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = if (prominent) 24.dp else 36.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        androidx.compose.foundation.Image(
            painter = painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(if (prominent) 28.dp else 24.dp),
            alpha = if (selected || prominent) 1f else 0.72f,
            colorFilter = ColorFilter.tint(if (selected || prominent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant),
        )
        if (supportingText == null) {
            Text(
                label,
                color = if (selected || prominent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = if (selected || prominent) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal,
                ),
            )
        } else {
            Column {
                Text(label, color = if (selected || prominent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold))
                Text(supportingText, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    androidx.compose.material3.Surface(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline),
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@androidx.compose.runtime.Composable
private fun HostEditor(
    initial: NativeHost,
    keys: List<NativeKey>,
    repository: HostRepository,
    onCancel: () -> Unit,
    onSaved: () -> Unit,
    onSavedAndConnect: (NativeHost) -> Unit,
) {
    var host by remember(initial) { mutableStateOf(initial) }
    var error by remember(initial) { mutableStateOf("") }
    var saving by remember(initial) { mutableStateOf(false) }
    var actionsExpanded by remember { mutableStateOf(false) }
    var showDiscardConfirmation by remember { mutableStateOf(false) }
    val requestClose = {
        if (host == initial) onCancel() else showDiscardConfirmation = true
    }
    fun saveHost(connect: Boolean) {
        error = when {
            host.hostname.isBlank() -> "Host is required"
            host.username.isBlank() -> "Username is required"
            host.port !in 1..65535 -> "Port must be between 1 and 65535"
            else -> ""
        }
        if (error.isNotBlank()) return
        saving = true
        repository.save(host) { result ->
            result.onSuccess { saved ->
                if (connect) onSavedAndConnect(saved) else onSaved()
            }.onFailure {
                saving = false
                error = it.message ?: "Unable to save host"
            }
        }
    }
    NativePageDrawer(
        onDismissRequest = requestClose,
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight()) {
            Row(
                Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(if (initial.id.isEmpty()) "Add host" else "Edit host", style = MaterialTheme.typography.titleLarge.copy(fontSize = 21.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold))
                    Text("SSH connection profile", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = requestClose) { androidx.compose.foundation.Image(painterResource(R.drawable.ic_close), "Close ${host.name.ifBlank { host.hostname }}", Modifier.size(20.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurfaceVariant)) }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                if (initial.id.isEmpty()) "Create a secure connection" else "Update connection settings",
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ShellCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Connection", style = MaterialTheme.typography.titleMedium)
            Text("How this host should appear and where it is located.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Name", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.name, { host = host.copy(name = it) }, "Name")
            Text("Tags", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.tags.joinToString(", "), { value -> host = host.copy(tags = value.split(',').map(String::trim).filter(String::isNotBlank).distinct()) }, "Type tag and press Enter")
            Text("Separate tags with commas", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Hostname", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.hostname, { host = host.copy(hostname = it) }, "Hostname")
            Text("Port", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.port.toString(), { value -> value.toIntOrNull()?.let { port -> host = host.copy(port = port) } }, "Port")
            Text("Username", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.username, { host = host.copy(username = it) }, "Username")
                }
            }
            ShellCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Authentication", style = MaterialTheme.typography.titleMedium)
            Text("Choose how Shell360 authenticates with this host.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Password", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.password, { host = host.copy(password = it) }, "Password", password = true)
            Text("Authentication method", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NativeAuthenticationMethod.entries.forEach { method ->
                    FilterChip(
                        selected = host.authenticationMethod == method,
                        onClick = { host = host.copy(authenticationMethod = method) },
                        label = { Text(authenticationMethodLabel(method)) },
                    )
                }
            }
            if (host.authenticationMethod == NativeAuthenticationMethod.PublicKey || host.authenticationMethod == NativeAuthenticationMethod.Certificate) {
                val selected = keys.firstOrNull { it.id == host.keyId }
                Text("Key: ${selected?.name ?: "None selected"}")
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    keys.forEach { key -> Button(onClick = { host = host.copy(keyId = key.id) }) { Text(key.name.ifBlank { key.id.take(8) }) } }
                }
            }
                }
            }
            ShellCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Advanced", style = MaterialTheme.typography.titleMedium)
            Text("Optional values applied after the session opens.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Environment variables", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            OutlinedTextField(
                host.envs.entries.joinToString("\n") { "${it.key}=${it.value}" },
                { value ->
                    host = host.copy(envs = value.lineSequence().mapNotNull { line ->
                        val separator = line.indexOf('=')
                        if (separator <= 0) null else line.substring(0, separator).trim() to line.substring(separator + 1)
                    }.toMap())
                },
                Modifier.fillMaxWidth(),
                placeholder = { Text("KEY=VALUE") },
                supportingText = { Text("One KEY=VALUE per line") },
                minLines = 3,
            )
            Text("Startup Command", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.startupCommand, { host = host.copy(startupCommand = it) }, "Command to execute after connection (optional)")
            Text("Terminal type", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.terminalType, { host = host.copy(terminalType = it) }, "Terminal type")
            Text("Terminal font size", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
            NativeCompactField(host.terminalFontSize.toString(), { value -> value.toIntOrNull()?.let { size -> host = host.copy(terminalFontSize = size.coerceIn(8, 40)) } }, "Terminal font size")
            Text("8–40 sp", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            }
            Column(modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal = 16.dp, vertical = 10.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (error.isNotBlank()) {
                    Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = requestClose, enabled = !saving, modifier = Modifier.weight(1f).height(48.dp).semantics { contentDescription = "Cancel host editor" }, shape = RoundedCornerShape(12.dp)) {
                        Text("Cancel")
                    }
                    Row(modifier = Modifier.weight(1f).height(48.dp)) {
                    Button(onClick = { saveHost(connect = false) }, enabled = !saving, modifier = Modifier.weight(1f).height(48.dp).semantics { contentDescription = "Save host" }, shape = RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp, topEnd = 0.dp, bottomEnd = 0.dp)) {
                    Text(if (saving) "Saving…" else "Save")
                    }
                    Box {
                    Button(onClick = { actionsExpanded = true }, enabled = !saving, modifier = Modifier.height(48.dp).semantics { contentDescription = "More host actions" }, shape = RoundedCornerShape(topStart = 0.dp, bottomStart = 0.dp, topEnd = 12.dp, bottomEnd = 12.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp)) {
                        androidx.compose.foundation.Image(painterResource(R.drawable.ic_more), "More actions for ${host.name.ifBlank { host.hostname }}", Modifier.size(18.dp), colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onPrimary))
                    }
                    DropdownMenu(expanded = actionsExpanded, onDismissRequest = { actionsExpanded = false }) {
                        DropdownMenuItem(text = { Text("Save & Connect") }, onClick = {
                        actionsExpanded = false
                            saveHost(connect = true)
                        })
                    }
                    }
                    }
                }
            }
        }
    }
    if (showDiscardConfirmation) {
        AlertDialog(
            onDismissRequest = { showDiscardConfirmation = false },
            title = { Text("Discard changes?") },
            text = { Text("Your unsaved host changes will be lost.") },
            confirmButton = {
                Button(onClick = { showDiscardConfirmation = false; onCancel() }) { Text("Discard") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showDiscardConfirmation = false }) { Text("Keep editing") }
            },
        )
    }
}

private fun authenticationMethodLabel(method: NativeAuthenticationMethod): String = when (method) {
    NativeAuthenticationMethod.Password -> "Password"
    NativeAuthenticationMethod.PublicKey -> "Key"
    NativeAuthenticationMethod.Certificate -> "Certificate"
    NativeAuthenticationMethod.Agent -> "Agent"
    NativeAuthenticationMethod.KeyboardInteractive -> "Interactive"
}
