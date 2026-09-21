package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.session.WorkspaceSessionState
import com.nashaofu.shell360.R
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectScreen(
    host: NativeHost,
    keys: List<NativeKey>,
    session: NativeSshSession,
    knownHostRepository: KnownHostRepository,
    onConnected: (NativeSshSession) -> Unit,
    onBack: () -> Unit,
    onStateChange: (WorkspaceSessionState, String?) -> Unit = { _, _ -> },
) {
    var password by remember(host) { mutableStateOf(host.password) }
    var status by remember { mutableStateOf("") }
    var unknownKey by remember { mutableStateOf<NativeSshFailure?>(null) }
    var prompts by remember { mutableStateOf<List<Pair<String, Boolean>>>(emptyList()) }
    var answers by remember { mutableStateOf<List<String>>(emptyList()) }
    var connecting by remember { mutableStateOf(false) }
    var changedServerKey by remember { mutableStateOf<NativeSshFailure?>(null) }
    var authenticationMethod by remember(host) { mutableStateOf(host.authenticationMethod) }
    val connectionHost = host.copy(password = password, authenticationMethod = authenticationMethod)
    fun authenticateConnected() {
        session.authenticate(connectionHost, keys.firstOrNull { it.id == host.keyId }) { auth ->
            auth.fold(
                { connecting = false; status = "Connected"; onStateChange(WorkspaceSessionState.Connected, null); onConnected(session) },
                { error ->
                    val failure = error as? NativeSshFailure
                    if (failure?.code == "SSH_KEYBOARD_INTERACTIVE_REQUIRED") {
                        val data = failure.details
                        val values = (0 until (data?.optJSONArray("prompts")?.length() ?: 0)).map { index ->
                            val prompt = data?.optJSONArray("prompts")?.optJSONObject(index)
                            Pair(prompt?.optString("prompt") ?: "Answer", prompt?.optBoolean("echo", false) ?: false)
                        }
                        prompts = values
                        answers = values.map { "" }
                        connecting = false
                        onStateChange(WorkspaceSessionState.Authenticating, error.message)
                    } else {
                        connecting = false
                        onStateChange(WorkspaceSessionState.Error, error.message)
                        status = error.message ?: "Authentication failed"
                        session.disconnect()
                    }
                },
            )
        }
    }
    fun startConnection() {
        status = "Connecting…"
        connecting = true
        onStateChange(WorkspaceSessionState.Connecting, null)
        session.connect(connectionHost) { result ->
            result.fold(
                onSuccess = { authenticateConnected() },
                onFailure = { error ->
                    val failure = error as? NativeSshFailure
                    if (failure?.code == "SSH_UNKNOWN_SERVER_KEY") {
                        connecting = false
                        onStateChange(WorkspaceSessionState.VerifyingHost, failure.message)
                        unknownKey = failure
                    } else if (failure?.message?.contains("server key changed", ignoreCase = true) == true) {
                        connecting = false
                        onStateChange(WorkspaceSessionState.VerifyingHost, failure.message)
                        changedServerKey = failure
                    } else {
                        connecting = false
                        onStateChange(WorkspaceSessionState.Error, error.message)
                        status = error.message ?: "Connection failed"
                        session.disconnect()
                    }
                },
            )
        }
    }
    LaunchedEffect(connecting) {
        if (connecting) {
            delay(15_000)
            if (connecting) {
                connecting = false
                status = "Connection timed out"
                onStateChange(WorkspaceSessionState.Error, status)
                session.disconnect()
            }
        }
    }
    Scaffold(topBar = { NativeTopBar("Connect", onBack = onBack) }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().navigationBarsPadding().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ConnectionIdentityCard(host)
            ConnectionStatusCard(connecting, unknownKey != null, changedServerKey != null, status)
            ShellCard(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Authentication", style = MaterialTheme.typography.titleMedium)
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NativeAuthenticationMethod.entries.forEach { method ->
                            FilterChip(
                                selected = authenticationMethod == method,
                                onClick = { authenticationMethod = method },
                                label = { Text(authenticationMethodLabel(method)) },
                            )
                        }
                    }
                    when (authenticationMethod) {
                        NativeAuthenticationMethod.Password -> NativeCompactField(password, { password = it }, "Password", password = true, fieldHeight = 48.dp)
                        NativeAuthenticationMethod.PublicKey, NativeAuthenticationMethod.Certificate -> {
                            Text("Key: ${keys.firstOrNull { it.id == host.keyId }?.name ?: "Not selected"}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        else -> Text("The server will request the authentication details after connecting.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            if (!connecting && status.isNotBlank() && status != "Connected" && unknownKey == null && changedServerKey == null) {
                OutlinedButton(onClick = ::startConnection, modifier = Modifier.fillMaxWidth().height(46.dp), shape = RoundedCornerShape(12.dp)) { Text("Retry") }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = { session.disconnect(); onBack() }, modifier = Modifier.weight(1f).height(50.dp), shape = RoundedCornerShape(12.dp)) { Text("Cancel") }
                Button(enabled = !connecting, onClick = ::startConnection, modifier = Modifier.weight(1f).height(50.dp), shape = RoundedCornerShape(12.dp)) { Text(if (connecting) "Connecting…" else if (status.isNotBlank() && status != "Connected") "Retry" else "Connect") }
            }
        }
    }
    unknownKey?.let { failure ->
        AlertDialog(
            onDismissRequest = {
                unknownKey = null
                session.disconnect()
            },
            title = { Text("First connection to this host") },
            text = { Text("The server identity cannot be verified automatically.\n\nHost: ${host.hostname}:${host.port}\n\n${failure.message}") },
            confirmButton = {
                Button(onClick = {
                    unknownKey = null
                    connecting = true
                    status = "Connecting…"
                    session.connect(connectionHost, "AddAndContinue") { result ->
                        result.onSuccess { authenticateConnected() }.onFailure {
                            connecting = false
                            status = it.message ?: "Connection failed"
                            session.disconnect()
                        }
                    }
                }) { Text("Save and Continue") }
            },
            dismissButton = {
                Button(onClick = {
                    unknownKey = null
                    connecting = true
                    status = "Connecting…"
                    session.connect(connectionHost, "Continue") { result ->
                        result.onSuccess { authenticateConnected() }.onFailure {
                            connecting = false
                            status = it.message ?: "Connection failed"
                            session.disconnect()
                        }
                    }
                }) { Text("Continue Once") }
            },
        )
    }
    changedServerKey?.let { failure ->
        AlertDialog(
            onDismissRequest = { changedServerKey = null; session.disconnect() },
            title = { Text("Server identity has changed") },
            text = { Text("The current fingerprint does not match the saved fingerprint. This may be caused by a server rebuild or a security attack.\n\nHost: ${host.hostname}:${host.port}\n\n${failure.message}") },
            confirmButton = {
                Button(onClick = {
                    changedServerKey = null
                    connecting = true
                    status = "Connecting…"
                    knownHostRepository.removeHost(host.hostname, host.port)
                    session.connect(connectionHost, "AddAndContinue") { result ->
                        result.onSuccess { authenticateConnected() }.onFailure {
                            connecting = false
                            status = it.message ?: "Connection failed"
                            session.disconnect()
                        }
                    }
                }) { Text("Replace and continue") }
            },
            dismissButton = { Button(onClick = { changedServerKey = null; session.disconnect() }) { Text("Cancel") } },
        )
    }
    if (prompts.isNotEmpty()) {
        AlertDialog(
            onDismissRequest = { prompts = emptyList() },
            title = { Text("Keyboard interactive authentication") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    prompts.forEachIndexed { index, prompt ->
                        OutlinedTextField(
                            answers[index],
                            { value -> answers = answers.toMutableList().also { it[index] = value } },
                            label = { Text(prompt.first) },
                            modifier = Modifier.fillMaxWidth(),
                            visualTransformation = if (prompt.second) androidx.compose.ui.text.input.VisualTransformation.None else androidx.compose.ui.text.input.PasswordVisualTransformation(),
                        )
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    session.authenticateKeyboardInteractive(answers) { result ->
                        result.onSuccess { prompts = emptyList(); connecting = false; status = "Connected"; onStateChange(WorkspaceSessionState.Connected, null); onConnected(session) }
                            .onFailure {
                                prompts = emptyList()
                                connecting = false
                                onStateChange(WorkspaceSessionState.Error, it.message)
                                status = it.message ?: "Authentication failed"
                                session.disconnect()
                            }
                    }
                }) { Text("Submit") }
            },
        )
    }
}

@Composable
private fun ConnectionIdentityCard(host: NativeHost) {
    ShellCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            androidx.compose.foundation.Image(
                painterResource(R.drawable.ic_workspace),
                contentDescription = "Host",
                modifier = Modifier.size(42.dp),
                colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary),
            )
            Spacer(Modifier.width(12.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(host.name.ifBlank { host.hostname }, style = MaterialTheme.typography.titleLarge)
                Text("${host.username}@${host.hostname}:${host.port}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("SSH connection", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun ConnectionStatusCard(connecting: Boolean, unknownKey: Boolean, changedServerKey: Boolean, status: String) {
    val verifying = unknownKey || changedServerKey
    val failed = !connecting && !verifying && status.isNotBlank() && status != "Connected"
    val connected = status == "Connected"
    val icon = when {
        connecting -> R.drawable.ic_refresh
        verifying -> R.drawable.ic_fingerprint
        failed -> R.drawable.ic_close
        else -> R.drawable.ic_workspace
    }
    val title = when {
        connecting -> "Connecting…"
        unknownKey -> "Verify server identity"
        changedServerKey -> "Server identity changed"
        failed -> "Connection failed"
        connected -> "Connected"
        else -> "Ready to connect"
    }
    val detail = when {
        connecting -> "Opening a secure SSH connection"
        unknownKey -> "Review the fingerprint before continuing"
        changedServerKey -> "The saved fingerprint no longer matches"
        failed -> status
        connected -> "Secure session established"
        else -> "Your host is ready"
    }
    ShellCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            androidx.compose.foundation.Image(
                painterResource(icon),
                contentDescription = null,
                modifier = Modifier.size(28.dp),
                colorFilter = ColorFilter.tint(if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (connecting) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 14.dp))
    }
}

private fun authenticationMethodLabel(method: NativeAuthenticationMethod): String = when (method) {
    NativeAuthenticationMethod.Password -> "Password"
    NativeAuthenticationMethod.PublicKey -> "Key"
    NativeAuthenticationMethod.Certificate -> "Certificate"
    NativeAuthenticationMethod.Agent -> "Agent"
    NativeAuthenticationMethod.KeyboardInteractive -> "Interactive"
}
