package com.nashaofu.shell360

import android.os.Bundle
import android.net.Uri
import android.content.res.Configuration
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.viewModels
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import com.nashaofu.shell360.bridge.AndroidFileBridge
import com.nashaofu.shell360.bridge.PlatformHostServices
import com.nashaofu.shell360.nativeui.HostRepository
import com.nashaofu.shell360.nativeui.HostScreen
import com.nashaofu.shell360.nativeui.KeyRepository
import com.nashaofu.shell360.nativeui.KeyScreen
import com.nashaofu.shell360.nativeui.KnownHostRepository
import com.nashaofu.shell360.nativeui.KnownHostScreen
import com.nashaofu.shell360.nativeui.ConnectScreen
import com.nashaofu.shell360.nativeui.NativeHost
import com.nashaofu.shell360.nativeui.NativeSshSession
import com.nashaofu.shell360.nativeui.NativeWorkspaceSession
import com.nashaofu.shell360.nativeui.WorkspaceScreen
import com.nashaofu.shell360.nativeui.WorkspaceSessionSurface
import com.nashaofu.shell360.terminal.NativeTerminalSession
import com.nashaofu.shell360.nativeui.TerminalScreen
import com.nashaofu.shell360.nativeui.PortForwardingRepository
import com.nashaofu.shell360.nativeui.PortForwardingScreen
import com.nashaofu.shell360.nativeui.NativeSftpSession
import com.nashaofu.shell360.nativeui.SftpScreen
import com.nashaofu.shell360.nativeui.SettingsScreen
import com.nashaofu.shell360.nativeui.UnlockScreen
import com.nashaofu.shell360.session.ActiveSftpSession
import com.nashaofu.shell360.session.ActiveTerminalSession
import com.nashaofu.shell360.session.SessionStore
import com.nashaofu.shell360.session.PendingWorkspaceSession
import com.nashaofu.shell360.session.WorkspaceSessionState
import com.nashaofu.shell360.presentation.AppViewModel
import com.nashaofu.shell360.presentation.NativeRoute
import com.nashaofu.shell360.terminal.NativeRuntimeClient
import com.nashaofu.shell360.terminal.NativeRuntimeViewModel
import com.nashaofu.shell360.ui.theme.Shell360Theme
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject

@androidx.compose.material3.ExperimentalMaterial3Api
class MainActivity : ComponentActivity() {
    private val runtimeViewModel: NativeRuntimeViewModel by viewModels()
    private lateinit var fileBridge: AndroidFileBridge
    private var nativeRuntimeClient: NativeRuntimeClient? = null

    private fun exportNativeData(runtime: NativeRuntimeClient) {
        runtime.request("data.getHosts") { hosts ->
            runtime.request("data.getKeys") { keys ->
                runtime.request("data.getPortForwardings") { forwards ->
                    val payload = JSONObject().put("hosts", hosts.optJSONArray("data") ?: JSONArray())
                        .put("keys", keys.optJSONArray("data") ?: JSONArray())
                        .put("portForwardings", forwards.optJSONArray("data") ?: JSONArray())
                    thread {
                        runCatching {
                            fileBridge.save("shell360.json")?.let { uri ->
                                contentResolver.openOutputStream(Uri.parse(uri))?.use {
                                    it.write(payload.toString().toByteArray(Charsets.UTF_8))
                                } ?: error("The selected export destination could not be opened.")
                            }
                        }.onFailure { error ->
                            runOnUiThread {
                                Toast.makeText(
                                    this,
                                    error.message ?: "Export failed",
                                    Toast.LENGTH_LONG,
                                ).show()
                            }
                        }
                    }
        }
    }
        }
    }

    private fun importNativeData(runtime: NativeRuntimeClient, onComplete: () -> Unit) {
        thread {
            runCatching {
                val uri = fileBridge.open() ?: return@runCatching
                val text = contentResolver.openInputStream(Uri.parse(uri))?.bufferedReader()?.use { it.readText() }
                    ?: error("The selected import file could not be opened.")
                val root = JSONObject(text)
                val operations = buildList {
                    root.optJSONArray("hosts")?.let { array -> for (i in 0 until array.length()) add("data.addHost" to array.getJSONObject(i)) }
                    root.optJSONArray("keys")?.let { array -> for (i in 0 until array.length()) add("data.addKey" to array.getJSONObject(i)) }
                    root.optJSONArray("portForwardings")?.let { array -> for (i in 0 until array.length()) add("data.addPortForwarding" to array.getJSONObject(i)) }
                }
                fun next(index: Int) {
                    if (index == operations.size) {
                        runOnUiThread {
                            onComplete()
                            Toast.makeText(this, "Import completed", Toast.LENGTH_SHORT).show()
                        }
                        return
                    }
                    val (method, value) = operations[index]
                    value.remove("id")
                    runtime.request(method, value) { response ->
                        if (response.has("error")) {
                            runOnUiThread { Toast.makeText(this, response.optJSONObject("error")?.optString("message") ?: "Import failed", Toast.LENGTH_LONG).show() }
                        } else {
                            next(index + 1)
                        }
                    }
                }
                next(0)
            }.onFailure { error ->
                runOnUiThread { Toast.makeText(this, error.message ?: "Import failed", Toast.LENGTH_LONG).show() }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keep Compose content below system bars, matching mobile's safe-area padding.
        WindowCompat.setDecorFitsSystemWindows(window, true)
        val isDarkSystemTheme = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val savedAppearance = getSharedPreferences("shell360-appearance", MODE_PRIVATE).getString("mode", "inherit") ?: "inherit"
        val darkSystemBars = when (savedAppearance) {
            "dark" -> true
            "light" -> false
            else -> isDarkSystemTheme
        }
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !darkSystemBars
            isAppearanceLightNavigationBars = !darkSystemBars
        }

        val rustBridge = (application as Shell360Application).rustBridge
        fileBridge = AndroidFileBridge(this)
        val hostServices = PlatformHostServices(
            context = this,
            fileBridge = fileBridge,
            closeWindow = {
                runOnUiThread {
                    finishAndRemoveTask()
                }
            },
            backToBackground = {
                runOnUiThread {
                    moveTaskToBack(true)
                }
            },
            resetApplication = {
                runOnUiThread {
                    window.decorView.postDelayed(
                        {
                            rustBridge.shutdown()
                            finishAndRemoveTask()
                            android.os.Process.killProcess(android.os.Process.myPid())
                        },
                        250,
                    )
                }
            },
            setSystemBarsAppearance = { dark ->
                runOnUiThread {
                    WindowCompat.getInsetsController(window, window.decorView).apply {
                        isAppearanceLightStatusBars = !dark
                        isAppearanceLightNavigationBars = !dark
                    }
                }
            },
        )
        val nativeClient = runtimeViewModel.bind(hostServices).also { nativeRuntimeClient = it }
        setContent {
            val appearancePreferences = androidx.compose.runtime.remember {
                getSharedPreferences("shell360-appearance", MODE_PRIVATE)
            }
            var appearance by androidx.compose.runtime.remember {
                androidx.compose.runtime.mutableStateOf(
                    appearancePreferences.getString("mode", "inherit") ?: "inherit",
                )
            }
            var defaultFontSize by androidx.compose.runtime.remember { androidx.compose.runtime.mutableIntStateOf(appearancePreferences.getInt("defaultFontSize", 18)) }
            var defaultTerminalType by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(appearancePreferences.getString("defaultTerminalType", "xterm-256color") ?: "xterm-256color") }
            var shortcutBar by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(appearancePreferences.getBoolean("shortcutBar", true)) }
            Shell360Theme(
                darkTheme = when (appearance) {
                    "dark" -> true
                    "light" -> false
                    else -> androidx.compose.foundation.isSystemInDarkTheme()
                },
                dynamicColor = appearance == "inherit",
            ) {
                SideEffect {
                    val dark = appearance == "dark" || (appearance == "inherit" && isDarkSystemTheme)
                    val bars = WindowCompat.getInsetsController(window, window.decorView)
                    bars.isAppearanceLightStatusBars = !dark
                    bars.isAppearanceLightNavigationBars = !dark
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                        val appearance = if (dark) 0 else {
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                                android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                        }
                        window.insetsController?.setSystemBarsAppearance(
                            appearance,
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                                android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                        )
                    }
                }
                val appViewModel: AppViewModel = viewModel()
                    val hostRepository = androidx.compose.runtime.remember { HostRepository(nativeClient) }
                    val keyRepository = androidx.compose.runtime.remember { KeyRepository(nativeClient) }
                    val knownHostRepository = androidx.compose.runtime.remember { KnownHostRepository(this@MainActivity) }
                    val portForwardingRepository = androidx.compose.runtime.remember { PortForwardingRepository(nativeClient) }
                    var selectedHost by appViewModel.selectedHost
                    var editHostRequest by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
                    var connectedSsh by appViewModel.connectedSsh
                    var terminalSession by appViewModel.terminalSession
                    val sessionStore: SessionStore = viewModel()
                    androidx.compose.runtime.LaunchedEffect(sessionStore.pending.map { it.id to it.state }) {
                        val pendingAtStart = sessionStore.pending.filter { it.state == WorkspaceSessionState.Connecting }
                        pendingAtStart.forEach { pending ->
                            kotlinx.coroutines.delay(15_000)
                            val stillConnecting = sessionStore.pending.firstOrNull { it.id == pending.id }?.state == WorkspaceSessionState.Connecting
                            if (stillConnecting) {
                                sessionStore.updatePending(pending.id, WorkspaceSessionState.Error, "Connection timed out")
                                NativeSshSession(nativeClient, pending.id).disconnect()
                            }
                        }
                    }
                    val workspaceSessions = sessionStore.pending.map { item ->
                        NativeWorkspaceSession(item.id, item.host.id, item.host.name.ifBlank { item.host.hostname }, item.type, item.state.name, item.errorMessage, item.createdAt, item.lastActiveAt)
                    } + sessionStore.terminals.map { item ->
                        NativeWorkspaceSession(item.ssh.id, item.host.id, item.host.name.ifBlank { item.host.hostname }, "Terminal", item.state.name, item.errorMessage, item.createdAt, item.lastActiveAt)
                    } + sessionStore.sftps.map { item ->
                        NativeWorkspaceSession(item.ssh.id, item.host.id, item.host.name.ifBlank { item.host.hostname }, "SFTP", item.state.name, item.errorMessage, item.createdAt, item.lastActiveAt)
                    }
                    var keys by appViewModel.keys
                    var nativeLocked by appViewModel.nativeLocked
                    var dataVersion by appViewModel.dataVersion
                    var openDrawerRequest by appViewModel.openDrawerRequest
                    var sessionPickerRequest by appViewModel.sessionPickerRequest
                    var drawerRoute by appViewModel.drawerRoute
                    val openNavigation = {
                        appViewModel.openNavigation()
                        drawerRoute = appViewModel.drawerRoute.value
                        openDrawerRequest++
                        Unit
                    }
                    val openWorkspace = {
                        appViewModel.navigate(NativeRoute.Workspace)
                        drawerRoute = 9
                        Unit
                    }
                    fun openGlobalRoute(route: NativeRoute, page: Int) {
                        appViewModel.navigate(route)
                        drawerRoute = page
                    }
                    androidx.compose.runtime.LaunchedEffect(Unit) {
                        keyRepository.getAll { it.onSuccess { value -> keys = value } }
                        nativeClient.request("data.checkIsEnableCrypto") { enabled ->
                            nativeClient.request("data.checkIsInitCrypto") { initialized ->
                                nativeClient.request("data.checkIsAuthed") { authed ->
                                    nativeLocked = enabled.optBoolean("data", false) && initialized.optBoolean("data", false) && !authed.optBoolean("data", false)
                                }
                            }
                        }
                    }
                    BackHandler(enabled = appViewModel.route.value != NativeRoute.Hosts) {
                        when (val route = appViewModel.route.value) {
                            is NativeRoute.Terminal, is NativeRoute.Sftp -> {
                                appViewModel.navigate(NativeRoute.Workspace)
                            }
                            NativeRoute.Workspace -> openGlobalRoute(NativeRoute.Hosts, 0)
                            NativeRoute.Hosts -> moveTaskToBack(true)
                            else -> openGlobalRoute(NativeRoute.Hosts, 0)
                        }
                    }
                if (nativeLocked == true) {
                        UnlockScreen(nativeClient) { nativeLocked = false }
                    } else if (nativeLocked == null) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Loading…") }
                    } else when (val route = appViewModel.route.value) {
                        NativeRoute.Keys -> KeyScreen(keyRepository, hostRepository, onBack = { openGlobalRoute(NativeRoute.Hosts, 0) }, onOpenDrawer = openNavigation)
                        NativeRoute.KnownHosts -> KnownHostScreen(knownHostRepository, onBack = { openGlobalRoute(NativeRoute.Hosts, 0) }, onOpenDrawer = openNavigation)
                        NativeRoute.PortForwarding -> {
                            PortForwardingScreen(
                                portForwardingRepository,
                                hostRepository,
                                onBack = { openGlobalRoute(NativeRoute.Hosts, 0) },
                                onOpenDrawer = openNavigation,
                                session = connectedSsh,
                            )
                        }
                        is NativeRoute.Sftp -> sessionStore.sftps.firstOrNull { it.ssh.id == connectedSsh?.id }?.let { active ->
                            SftpScreen(
                                active.sftp,
                                onBack = { appViewModel.navigate(NativeRoute.Workspace) },
                                onOpenDrawer = openNavigation,
                                onShowSessions = { appViewModel.navigate(NativeRoute.Workspace) },
                                onCloseSession = {
                                    sessionStore.closeSftp(active.ssh.id) { connectedSsh = null; openGlobalRoute(NativeRoute.Hosts, 0) }
                                },
                            )
                        }
                        NativeRoute.Settings -> SettingsScreen(
                            runtime = nativeClient,
                            onBack = { openGlobalRoute(NativeRoute.Hosts, 0) },
                            onOpenDrawer = openNavigation,
                            onExportData = { exportNativeData(nativeClient) },
                            onImportData = { importNativeData(nativeClient) { dataVersion++ } },
                            onResetAppData = { nativeClient.request("data.resetCrypto") {} },
                            onOpenUrl = { url -> nativeClient.request("core.openUrl", org.json.JSONObject().put("url", url)) {} },
                            version = BuildConfig.VERSION_NAME,
                            appearance = appearance,
                            onAppearanceChange = {
                                appearance = it
                                appearancePreferences.edit().putString("mode", it).apply()
                                val dark = when (it) {
                                    "dark" -> true
                                    "light" -> false
                                    else -> isDarkSystemTheme
                                }
                                WindowCompat.getInsetsController(window, window.decorView).apply {
                                    isAppearanceLightStatusBars = !dark
                                    isAppearanceLightNavigationBars = !dark
                                }
                            },
                            defaultFontSize = defaultFontSize,
                            onDefaultFontSizeChange = { defaultFontSize = it; appearancePreferences.edit().putInt("defaultFontSize", it).apply() },
                            defaultTerminalType = defaultTerminalType,
                            onDefaultTerminalTypeChange = { defaultTerminalType = it; appearancePreferences.edit().putString("defaultTerminalType", it).apply() },
                            shortcutBar = shortcutBar,
                            onShortcutBarChange = { shortcutBar = it; appearancePreferences.edit().putBoolean("shortcutBar", it).apply() },
                        )
                        NativeRoute.Workspace -> WorkspaceScreen(
                            sessions = workspaceSessions,
                            activeSessionId = sessionStore.activeSessionId,
                            sessionPickerRequest = sessionPickerRequest,
                            activeSurface = sessionStore.activeSessionId?.let { sessionId ->
                                {
                                    WorkspaceSessionSurface(
                                        terminal = sessionStore.terminalFor(sessionId),
                                        sftp = sessionStore.sftpFor(sessionId),
                                        onLeave = { openGlobalRoute(NativeRoute.Hosts, 0) },
                                        onShowSessions = { sessionPickerRequest++ },
                                        defaultFontSize = defaultFontSize,
                                        defaultTerminalType = defaultTerminalType,
                                        shortcutBar = shortcutBar,
                                        onClose = {
                                            sessionStore.terminalFor(sessionId)?.let { sessionStore.closeTerminal(sessionId) }
                                            sessionStore.sftpFor(sessionId)?.let { sessionStore.closeSftp(sessionId) }
                                        },
                                    )
                                }
                            },
                            onBack = { openGlobalRoute(NativeRoute.Hosts, 0) },
                            onOpenDrawer = openNavigation,
                            onSelectSession = { sessionId ->
                                sessionStore.selectSession(sessionId)
                                sessionStore.terminalFor(sessionId)?.let { item ->
                                    selectedHost = item.host
                                    connectedSsh = item.ssh
                                    terminalSession = item.terminal
                                } ?: sessionStore.sftpFor(sessionId)?.let { item ->
                                    selectedHost = item.host
                                    connectedSsh = item.ssh
                                    terminalSession = null
                                }
                            },
                            onCloseSession = { sessionId ->
                                sessionStore.terminalFor(sessionId)?.let { item ->
                                    sessionStore.closeTerminal(sessionId) {
                                        if (connectedSsh?.id == sessionId) {
                                            connectedSsh = null
                                            terminalSession = null
                                        }
                                    }
                                } ?: sessionStore.sftpFor(sessionId)?.let { item ->
                                    sessionStore.closeSftp(sessionId) {
                                        if (connectedSsh?.id == sessionId) {
                                            connectedSsh = null
                                        }
                                    }
                                }
                            },
                            onRetrySession = { sessionId ->
                                sessionStore.pending.firstOrNull { it.id == sessionId }?.let { pending ->
                                    sessionStore.removePending(sessionId)
                                    val retrySession = NativeSshSession(nativeClient)
                                    sessionStore.addPending(PendingWorkspaceSession(retrySession.id, pending.host, pending.type))
                                    selectedHost = pending.host
                                    appViewModel.navigate(if (pending.type == "SFTP") NativeRoute.ConnectSftp(pending.host.id) else NativeRoute.ConnectTerminal(pending.host.id))
                                }
                            },
                            onRemoveSession = { sessionId -> sessionStore.removePending(sessionId) },
                            onEditHost = { hostId -> editHostRequest = hostId; openGlobalRoute(NativeRoute.Hosts, 0) },
                            onViewHosts = { openGlobalRoute(NativeRoute.Hosts, 0) },
                        )
                        is NativeRoute.ConnectTerminal -> selectedHost?.let { host ->
                            val pendingId = sessionStore.pending.firstOrNull { it.host.id == host.id && it.type == "Terminal" }?.id
                            val sshSession = androidx.compose.runtime.remember(host.id, pendingId) { NativeSshSession(nativeClient, pendingId) }
                            ConnectScreen(host, keys, sshSession, knownHostRepository, onConnected = {
                                sessionStore.removePending(it.id)
                                connectedSsh = it
                                val terminal = NativeTerminalSession(nativeClient, onClose = {
                                    runOnUiThread {
                                        sessionStore.removeTerminal(it.id)
                                        terminalSession = null
                                        it.disconnect {
                                            if (connectedSsh?.id == it.id) {
                                                connectedSsh = null
                                            }
                                        }
                                    }
                                })
                                terminalSession = terminal
                                sessionStore.addTerminal(ActiveTerminalSession(host, it, terminal))
                                appViewModel.navigate(NativeRoute.Workspace)
                            }, onStateChange = { state, message ->
                                sessionStore.updatePending(sshSession.id, state, message)
                            }, onBack = {
                                sessionStore.removePending(sshSession.id)
                                openGlobalRoute(NativeRoute.Hosts, 0)
                            })
                        }
                        is NativeRoute.ConnectSftp -> selectedHost?.let { host ->
                            val pendingId = sessionStore.pending.firstOrNull { it.host.id == host.id && it.type == "SFTP" }?.id
                            val sshSession = androidx.compose.runtime.remember(host.id, pendingId) { NativeSshSession(nativeClient, pendingId) }
                            ConnectScreen(host, keys, sshSession, knownHostRepository, onConnected = {
                                sessionStore.removePending(it.id)
                                connectedSsh = it
                                val sftp = NativeSftpSession(nativeClient, it.id, onRemoteClose = {
                                    runOnUiThread {
                                        sessionStore.removeSftp(it.id)
                                        it.disconnect {
                                            if (connectedSsh?.id == it.id) {
                                                connectedSsh = null
                                            }
                                        }
                                    }
                                })
                                sessionStore.addSftp(ActiveSftpSession(host, it, sftp))
                                appViewModel.navigate(NativeRoute.Workspace)
                            }, onStateChange = { state, message ->
                                sessionStore.updatePending(sshSession.id, state, message)
                            }, onBack = {
                                sessionStore.removePending(sshSession.id)
                                openGlobalRoute(NativeRoute.Hosts, 0)
                            })
                        }
                        is NativeRoute.Terminal -> {
                            val ssh = connectedSsh
                            val terminal = terminalSession
                            if (ssh != null && terminal != null) {
                                Column(Modifier.fillMaxSize().safeDrawingPadding().background(androidx.compose.material3.MaterialTheme.colorScheme.background)) {
                                    com.nashaofu.shell360.nativeui.NativeTopBar(
                                        selectedHost?.name?.ifBlank { selectedHost?.hostname ?: "Terminal" } ?: "Terminal",
                                        onOpenDrawer = openNavigation,
                                    ) {
                                        androidx.compose.material3.IconButton(modifier = Modifier.size(44.dp), onClick = { appViewModel.navigate(NativeRoute.Workspace) }) {
                                            androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_menu), "Sessions", Modifier.size(20.dp))
                                        }
                                        androidx.compose.material3.IconButton(modifier = Modifier.size(44.dp), onClick = { openGlobalRoute(NativeRoute.PortForwarding, 5) }) {
                                            androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_tunnel), "Port Forwarding", Modifier.size(20.dp))
                                        }
                                        androidx.compose.material3.IconButton(modifier = Modifier.size(44.dp), onClick = {
                                            sessionStore.closeTerminal(ssh.id) {
                                                if (connectedSsh?.id == ssh.id) {
                                                    connectedSsh = null
                                                    terminalSession = null
                                                }
                                            }
                                        }) {
                                            androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_close), "Disconnect", Modifier.size(20.dp))
                                        }
                                    }
                                    TerminalScreen(
                                        session = terminal,
                                        sshSessionId = ssh.id,
                                        terminalType = selectedHost?.terminalType ?: "xterm-256color",
                                        envs = selectedHost?.envs ?: emptyMap(),
                                        fontSize = selectedHost?.terminalFontSize ?: 18,
                                        startupCommand = selectedHost?.startupCommand ?: "",
                                        modifier = Modifier.weight(1f),
                                        onInput = terminal::send,
                                        onResize = terminal::resize,
                                        onClose = {
                                            sessionStore.closeTerminal(ssh.id) {
                                                if (connectedSsh?.id == ssh.id) {
                                                    connectedSsh = null
                                                    terminalSession = null
                                                }
                                            }
                                        },
                                    )
                                }
                            }
                        }
                        else -> androidx.compose.runtime.key(dataVersion) {
                            HostScreen(
                                hostRepository,
                                keys = keys,
                                activeSessionCount = workspaceSessions.size,
                                editHostRequest = editHostRequest,
                                onEditHostRequestConsumed = { editHostRequest = null },
                                openDrawerRequest = openDrawerRequest,
                                selectedRoute = drawerRoute,
                                onOpenHosts = { openGlobalRoute(NativeRoute.Hosts, 0) },
                                onOpenWorkspace = openWorkspace,
                                onOpenKeys = { openGlobalRoute(NativeRoute.Keys, 1) },
                                onOpenKnownHosts = { openGlobalRoute(NativeRoute.KnownHosts, 2) },
                                onOpenPortForwardings = { openGlobalRoute(NativeRoute.PortForwarding, 5) },
                                onOpenSettings = { openGlobalRoute(NativeRoute.Settings, 8) },
                            onConnect = { host ->
                                val pending = NativeSshSession(nativeClient)
                                sessionStore.addPending(PendingWorkspaceSession(pending.id, host, "Terminal"))
                                selectedHost = host
                                appViewModel.navigate(NativeRoute.ConnectTerminal(host.id))
                            },
                            onOpenSftp = { host ->
                                val pending = NativeSshSession(nativeClient)
                                sessionStore.addPending(PendingWorkspaceSession(pending.id, host, "SFTP"))
                                selectedHost = host
                                appViewModel.navigate(NativeRoute.ConnectSftp(host.id))
                            },
                            )
                        }
                }
                if (appViewModel.route.value !is NativeRoute.Hosts) {
                    HostScreen(
                        hostRepository,
                        keys = keys,
                        activeSessionCount = workspaceSessions.size,
                        editHostRequest = editHostRequest,
                        onEditHostRequestConsumed = { editHostRequest = null },
                        openDrawerRequest = openDrawerRequest,
                        selectedRoute = drawerRoute,
                        drawerOnly = true,
                        onOpenHosts = { openGlobalRoute(NativeRoute.Hosts, 0) },
                        onOpenWorkspace = openWorkspace,
                        onOpenKeys = { openGlobalRoute(NativeRoute.Keys, 1) },
                        onOpenKnownHosts = { openGlobalRoute(NativeRoute.KnownHosts, 2) },
                        onOpenPortForwardings = { openGlobalRoute(NativeRoute.PortForwarding, 5) },
                        onOpenSettings = { openGlobalRoute(NativeRoute.Settings, 8) },
                    )
                }
                }
            }
        }

    override fun onDestroy() {
        if (isFinishing && !isChangingConfigurations) nativeRuntimeClient?.close()
        if (isFinishing && !isChangingConfigurations) fileBridge.dispose()
        nativeRuntimeClient = null
        super.onDestroy()
    }

}
