package com.nashaofu.shell360.core.runtime

import android.content.Context
import android.util.Base64
import com.nashaofu.shell360.core.data.AppPrefs
import com.nashaofu.shell360.core.data.AuthMethod
import com.nashaofu.shell360.core.data.EnvVar
import com.nashaofu.shell360.core.data.HostModel
import com.nashaofu.shell360.core.data.HostTerminalSettings
import com.nashaofu.shell360.core.data.KeyModel
import com.nashaofu.shell360.core.data.KnownHostModel
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.data.TunnelType
import com.nashaofu.shell360.core.data.TunnelModel
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus
import com.nashaofu.shell360.feature.sftp.SftpEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.UUID

object AndroidRuntime {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    @Volatile private var client: NativeRuntimeClient? = null
    @Volatile private var appContext: Context? = null
    private val tunnelSessions = mutableMapOf<String, String>()

    suspend fun start(context: Context) {
        try {
            appContext = context.applicationContext
            val runtime = withContext(Dispatchers.IO) {
                client ?: NativeRuntimeClient(context).also { client = it }
            }
            val initialized = runtime.invoke("data.checkIsInitCrypto").booleanValue()
            if (!initialized) {
                runtime.invoke("data.initCryptoKey")
                runtime.invoke("data.changeCryptoEnable", JSONObject().put("cryptoEnable", false))
            }
            val encryptionEnabled = runtime.invoke("data.checkIsEnableCrypto").booleanValue()
            val authenticated = runtime.invoke("data.checkIsAuthed").booleanValue()
            Shell360Store.cryptoEnabled = encryptionEnabled
            Shell360Store.authed = authenticated
            if (authenticated) loadData(runtime, context)
            Shell360Store.runtimeError = null
            Shell360Store.runtimeReady = true
        } catch (error: Exception) {
            Shell360Store.runtimeError = error.message ?: "Could not initialize secure storage."
            Shell360Store.runtimeReady = false
        }
    }

    suspend fun invoke(method: String, data: JSONObject = JSONObject()): JSONObject =
        requireNotNull(client) { "Android runtime is not initialized." }.invoke(method, data)

    suspend fun setCryptoPassword(password: String, confirmPassword: String) {
        invoke("data.changeCryptoEnable", JSONObject()
            .put("cryptoEnable", true)
            .put("password", password)
            .put("confirmPassword", confirmPassword))
        Shell360Store.cryptoEnabled = true
        Shell360Store.authed = true
        Shell360Store.cryptoPassword = ""
    }

    suspend fun unlock(password: String) {
        invoke("data.loadCryptoByPassword", JSONObject().put("password", password))
        Shell360Store.authed = true
        loadData(requireNotNull(client), null)
    }

    fun lock() {
        if (Shell360Store.cryptoEnabled) {
            Shell360Store.authed = false
            Shell360Store.hosts.clear()
            Shell360Store.keys.clear()
            Shell360Store.tunnels.clear()
        }
    }

    suspend fun changeCryptoPassword(oldPassword: String, password: String, confirmPassword: String) {
        invoke(
            "data.changeCryptoPassword",
            JSONObject().put("oldPassword", oldPassword).put("password", password).put("confirmPassword", confirmPassword),
        )
    }

    suspend fun disableCrypto() {
        invoke("data.changeCryptoEnable", JSONObject().put("cryptoEnable", false))
        Shell360Store.cryptoEnabled = false
        Shell360Store.authed = true
    }

    suspend fun saveHost(host: HostModel): HostModel {
        val request = host.toBaseJson()
        val response = if (host.id.toLongOrNull() == null) {
            invoke("data.addHost", request)
        } else {
            invoke("data.updateHost", request.put("id", host.id))
        }
        val entity = response.optJSONObject("value") ?: response
        val base = entity.optJSONObject("base") ?: entity
        return base.toHost().copy(id = entity.optString("id", host.id))
    }

    suspend fun deleteHost(host: HostModel) {
        invoke("data.deleteHost", JSONObject().put("id", host.id).put("base", host.toBaseJson()))
    }

    suspend fun saveKey(key: KeyModel): KeyModel {
        val request = key.toBaseJson()
        val response = if (key.id.toLongOrNull() == null) {
            invoke("data.addKey", request)
        } else {
            invoke("data.updateKey", request.put("id", key.id))
        }
        val entity = response.optJSONObject("value") ?: response
        val base = entity.optJSONObject("base") ?: entity
        return base.toKey().copy(id = entity.optString("id", key.id))
    }

    suspend fun generateKey(name: String, algorithm: JSONObject, passphrase: String): KeyModel {
        val generated = invoke("keygen.generate", JSONObject()
            .put("algorithm", algorithm)
            .put("passphrase", passphrase.ifBlank { JSONObject.NULL }))
        return saveKey(KeyModel(
            name = name,
            privateKey = generated.optString("privateKey"),
            publicKey = generated.optString("publicKey"),
            passphrase = passphrase,
        ))
    }

    suspend fun deleteKey(key: KeyModel) {
        invoke("data.deleteKey", JSONObject().put("id", key.id).put("base", key.toBaseJson()))
    }

    suspend fun saveTunnel(tunnel: TunnelModel): TunnelModel {
        val request = tunnel.toBaseJson()
        val response = if (tunnel.id.toLongOrNull() == null) {
            invoke("data.addPortForwarding", request)
        } else {
            invoke("data.updatePortForwarding", request.put("id", tunnel.id))
        }
        val entity = response.optJSONObject("value") ?: response
        val base = entity.optJSONObject("base") ?: entity
        return base.toTunnel().copy(id = entity.optString("id", tunnel.id))
    }

    suspend fun deleteTunnel(tunnel: TunnelModel) {
        invoke("data.deletePortForwarding", JSONObject().put("id", tunnel.id).put("base", tunnel.toBaseJson()))
    }

    suspend fun replaceImportedData(oldHosts: List<HostModel>, oldKeys: List<KeyModel>, oldTunnels: List<TunnelModel>) {
        oldTunnels.filter { it.id.toLongOrNull() != null }.forEach { deleteTunnel(it) }
        oldHosts.filter { it.id.toLongOrNull() != null }.forEach { deleteHost(it) }
        oldKeys.filter { it.id.toLongOrNull() != null }.forEach { deleteKey(it) }

        val importedKeys = Shell360Store.keys.toList()
        val keyIdMap = mutableMapOf<String, String>()
        val savedKeys = importedKeys.map { key ->
            saveKey(key.copy(id = "" )).also { keyIdMap[key.id] = it.id }
        }
        Shell360Store.keys.clear()
        Shell360Store.keys.addAll(savedKeys)

        val importedHosts = Shell360Store.hosts.toList()
        val hostIdMap = mutableMapOf<String, String>()
        val createdHosts = importedHosts.map { host ->
            saveHost(host.copy(
                id = "",
                keyId = keyIdMap[host.keyId] ?: host.keyId,
                jumpHostIds = emptyList(),
            )).also { hostIdMap[host.id] = it.id }
        }
        val savedHosts = createdHosts.mapIndexed { index, created ->
            val source = importedHosts[index]
            if (source.jumpHostIds.isEmpty()) created else saveHost(created.copy(
                jumpHostIds = source.jumpHostIds.mapNotNull { hostIdMap[it] },
            ))
        }
        Shell360Store.hosts.clear()
        Shell360Store.hosts.addAll(savedHosts)

        val importedTunnels = Shell360Store.tunnels.toList()
        val savedTunnels = importedTunnels.map { tunnel ->
            saveTunnel(tunnel.copy(id = "", hostId = hostIdMap[tunnel.hostId] ?: tunnel.hostId))
        }
        Shell360Store.tunnels.clear()
        Shell360Store.tunnels.addAll(savedTunnels)

        appContext?.let { context ->
            val knownHostsFile = File(context.filesDir, "shell360/known_hosts")
            knownHostsFile.parentFile?.mkdirs()
            knownHostsFile.writeText(Shell360Store.knownHosts.joinToString("\n") { it.rawLine }.let { if (it.isEmpty()) "" else "$it\n" })
        }
    }

    suspend fun connectSession(session: com.nashaofu.shell360.core.data.SessionModel, host: HostModel, hostKeyDecision: String? = null) {
        try {
            connectAndAuthenticate(session.id, host, hostKeyDecision)

            if (session.kind == com.nashaofu.shell360.core.data.SessionKind.Terminal) {
                val shellId = UUID.randomUUID().toString()
                val dataChannelId = UUID.randomUUID().toString()
                requireNotNull(client).openBinaryChannel(dataChannelId) { bytes ->
                    if (bytes.isEmpty()) {
                        scope.launch {
                            Shell360Store.sessionById(session.id)?.let { current ->
                                Shell360Store.updateSession(current.copy(status = SessionStatus.Failed, error = "The SSH terminal channel closed."))
                            }
                        }
                        return@openBinaryChannel
                    }
                    val output = String(bytes, StandardCharsets.UTF_8)
                    scope.launch {
                        Shell360Store.sessionById(session.id)?.let { current ->
                            Shell360Store.updateSession(current.copy(terminalOutput = (current.terminalOutput + output).takeLast(120_000)))
                        }
                    }
                }
                invoke("ssh.shell.open", JSONObject()
                    .put("sshSessionId", session.id)
                    .put("sshShellId", shellId)
                    .put("dataChannelId", dataChannelId)
                    .put("term", host.terminalType)
                    .put("envs", JSONObject().apply { host.envs.forEach { put(it.key, it.value) } })
                    .put("size", JSONObject().put("col", 80).put("row", 24).put("width", 0).put("height", 0)))
                Shell360Store.sessionById(session.id)?.let { Shell360Store.updateSession(it.copy(sshShellId = shellId, terminalOutput = "")) }
                if (host.startupCommand.isNotBlank()) sendTerminalInput(session.copy(sshShellId = shellId), host.startupCommand + "\r")
            } else {
                val sftpId = UUID.randomUUID().toString()
                invoke("ssh.sftp.open", JSONObject().put("sshSessionId", session.id).put("sshSftpId", sftpId))
                Shell360Store.sessionById(session.id)?.let { Shell360Store.updateSession(it.copy(sshSftpId = sftpId)) }
            }
            Shell360Store.sessionById(session.id)?.let {
                Shell360Store.updateSession(it.copy(status = SessionStatus.Success, error = null, errorCode = null, errorType = null))
            }
        } catch (error: Exception) {
            val current = Shell360Store.sessionById(session.id) ?: session
            val nativeError = error as? NativeRuntimeException
            Shell360Store.updateSession(current.copy(
                status = SessionStatus.Failed,
                error = nativeError?.message ?: error.message ?: "SSH connection failed.",
                errorCode = nativeError?.code,
                errorType = if (nativeError?.code == "SSH_UNKNOWN_SERVER_KEY") "UnknownKey" else null,
            ))
        }
    }

    private suspend fun connectAndAuthenticate(sessionId: String, host: HostModel, hostKeyDecision: String? = null) {
        val connect = JSONObject()
            .put("sshSessionId", sessionId)
            .put("hostname", host.hostname)
            .put("port", host.port)
            .put("jumpHostSshSessionId", JSONObject.NULL)
        if (hostKeyDecision != null) connect.put("checkServerKey", hostKeyDecision)
        invoke("ssh.session.connect", connect)

        when (host.authenticationMethod) {
            AuthMethod.Password -> invoke("ssh.session.authenticatePassword", JSONObject()
                .put("sshSessionId", sessionId).put("username", host.username).put("password", host.password))
            AuthMethod.PublicKey, AuthMethod.Certificate -> {
                val key = Shell360Store.keys.firstOrNull { it.id == host.keyId }
                    ?: error("The selected key is not available.")
                val method = if (host.authenticationMethod == AuthMethod.Certificate) "ssh.session.authenticateCertificate" else "ssh.session.authenticatePublicKey"
                val auth = JSONObject()
                    .put("sshSessionId", sessionId)
                    .put("username", host.username)
                    .put("privateKey", key.privateKey)
                    .put("passphrase", key.passphrase.ifBlank { JSONObject.NULL })
                if (host.authenticationMethod == AuthMethod.Certificate) auth.put("certificate", key.certificate)
                invoke(method, auth)
            }
            AuthMethod.Agent -> invoke("ssh.session.authenticateAgent", JSONObject().put("sshSessionId", sessionId).put("username", host.username))
            AuthMethod.KeyboardInteractive -> invoke("ssh.session.authenticateKeyboardInteractive", JSONObject()
                .put("sshSessionId", sessionId).put("username", host.username).put("password", host.password))
        }
    }

    suspend fun readSftpDirectory(session: SessionModel, path: String): List<SftpEntry> {
        val entries = invoke("ssh.sftp.readDir", JSONObject().put("sshSftpId", session.sshSftpId).put("path", path)).arrayValue()
        return (0 until entries.length()).mapNotNull { index ->
            val item = entries.optJSONObject(index) ?: return@mapNotNull null
            val type = item.optString("fileType")
            SftpEntry(
                name = item.optString("name"), path = item.optString("path"),
                isDir = type.equals("Directory", true) || type.equals("Dir", true),
                isSymlink = type.equals("Symlink", true), size = item.optLong("size"),
                mtime = item.optLong("mtime"), permissions = item.optString("permissions", "-rw-r--r--"),
            )
        }
    }

    suspend fun sftpCreate(session: SessionModel, path: String, directory: Boolean) {
        invoke(if (directory) "ssh.sftp.createDir" else "ssh.sftp.createFile", JSONObject().put("sshSftpId", session.sshSftpId).put("path", path))
    }

    suspend fun sftpRename(session: SessionModel, oldPath: String, newPath: String) {
        invoke("ssh.sftp.rename", JSONObject().put("sshSftpId", session.sshSftpId).put("oldPath", oldPath).put("newPath", newPath))
    }

    suspend fun sftpDelete(session: SessionModel, path: String, directory: Boolean) {
        invoke(if (directory) "ssh.sftp.removeDir" else "ssh.sftp.removeFile", JSONObject().put("sshSftpId", session.sshSftpId).put("path", path))
    }

    suspend fun sftpReadText(session: SessionModel, path: String): String =
        invoke("ssh.sftp.readTextFile", JSONObject().put("sshSftpId", session.sshSftpId).put("path", path)).optString("value")

    suspend fun sftpWriteText(session: SessionModel, path: String, content: String) {
        invoke("ssh.sftp.writeTextFile", JSONObject().put("sshSftpId", session.sshSftpId).put("path", path).put("content", content))
    }

    suspend fun sftpUpload(session: SessionModel, sourceUri: String, remotePath: String) {
        val context = appContextOrThrow()
        val localFile = File(context.cacheDir, "shell360-transfers/${UUID.randomUUID()}")
        localFile.parentFile?.mkdirs()
        context.contentResolver.openInputStream(android.net.Uri.parse(sourceUri)).use { input ->
            requireNotNull(input) { "Could not open selected document." }.use { stream -> localFile.outputStream().use { stream.copyTo(it) } }
        }
        try {
            invoke("ssh.sftp.uploadFile", JSONObject().put("sshSftpId", session.sshSftpId).put("localFilename", localFile.absolutePath).put("remoteFilename", remotePath))
        } finally {
            localFile.delete()
        }
    }

    suspend fun sftpDownload(session: SessionModel, targetUri: String, remotePath: String) {
        val localFile = File(appContextOrThrow().cacheDir, "shell360-transfers/${UUID.randomUUID()}")
        localFile.parentFile?.mkdirs()
        try {
            invoke("ssh.sftp.downloadFile", JSONObject().put("sshSftpId", session.sshSftpId).put("localFilename", localFile.absolutePath).put("remoteFilename", remotePath))
            appContextOrThrow().contentResolver.openOutputStream(android.net.Uri.parse(targetUri)).use { output ->
                requireNotNull(output) { "Could not open destination document." }.use { stream -> localFile.inputStream().use { it.copyTo(stream) } }
            }
        } finally {
            localFile.delete()
        }
    }

    suspend fun toggleTunnel(tunnel: TunnelModel) {
        val connectedSessionId = tunnelSessions[tunnel.id]
        if (connectedSessionId != null) {
            val closeMethod = when (tunnel.type) {
                TunnelType.Local -> "ssh.portForwarding.closeLocal"
                TunnelType.Remote -> "ssh.portForwarding.closeRemote"
                TunnelType.Dynamic -> "ssh.portForwarding.closeDynamic"
            }
            invoke(closeMethod, JSONObject().put("sshPortForwardingId", tunnel.id))
            runCatching { invoke("ssh.session.disconnect", JSONObject().put("sshSessionId", connectedSessionId)) }
            tunnelSessions.remove(tunnel.id)
            tunnelAuth.remove(tunnel.id)
            Shell360Store.stopTunnel(tunnel.id)
            return
        }

        val host = Shell360Store.hostById(tunnel.hostId) ?: error("The tunnel host no longer exists.")
        startTunnel(tunnel, null)
    }

    private data class TunnelAuth(val method: AuthMethod, val password: String, val keyId: String)
    private val tunnelAuth = mutableMapOf<String, TunnelAuth>()

    fun close() {
        client?.close()
        client = null
        Shell360Store.runtimeReady = false
    }

    fun retryTunnel(tunnel: TunnelModel, method: AuthMethod, password: String, keyId: String, trustUnknownKey: Boolean) {
        scope.launch {
            tunnelAuth[tunnel.id] = TunnelAuth(method, password, keyId)
            runCatching { startTunnel(tunnel, if (trustUnknownKey) "AddAndContinue" else null) }
                .onFailure { Shell360Store.setTunnelError(tunnel.id, it.message ?: "Tunnel connection failed") }
        }
    }

    private suspend fun startTunnel(tunnel: TunnelModel, hostKeyDecision: String?) {
        val host = Shell360Store.hostById(tunnel.hostId) ?: error("The tunnel host no longer exists.")
        val sessionId = UUID.randomUUID().toString()
        val auth = tunnelAuth[tunnel.id]
        try {
            connectAndAuthenticate(sessionId, host.copy(
                authenticationMethod = auth?.method ?: host.authenticationMethod,
                password = auth?.password ?: host.password,
                keyId = auth?.keyId ?: host.keyId,
            ), hostKeyDecision)
            val request = JSONObject()
                .put("sshSessionId", sessionId)
                .put("sshPortForwardingId", tunnel.id)
                .put("localAddress", tunnel.localAddress)
                .put("localPort", tunnel.localPort)
            val method = when (tunnel.type) {
                TunnelType.Local -> "ssh.portForwarding.openLocal".also { request.put("remoteAddress", tunnel.remoteAddress).put("remotePort", tunnel.remotePort) }
                TunnelType.Remote -> "ssh.portForwarding.openRemote".also { request.put("remoteAddress", tunnel.remoteAddress).put("remotePort", tunnel.remotePort) }
                TunnelType.Dynamic -> "ssh.portForwarding.openDynamic"
            }
            invoke(method, request)
            tunnelSessions[tunnel.id] = sessionId
            Shell360Store.startTunnel(tunnel.id)
        } catch (error: Exception) {
            runCatching { invoke("ssh.session.disconnect", JSONObject().put("sshSessionId", sessionId)) }
            throw error
        }
    }

    suspend fun sendTerminalInput(session: com.nashaofu.shell360.core.data.SessionModel, input: String) {
        val shellId = session.sshShellId ?: return
        invoke("ssh.shell.send", JSONObject()
            .put("sshShellId", shellId)
            .put("data", Base64.encodeToString(input.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)))
    }

    suspend fun resizeTerminal(session: SessionModel, columns: Int, rows: Int, width: Int, height: Int) {
        val shellId = session.sshShellId ?: return
        invoke("ssh.shell.resize", JSONObject()
            .put("sshShellId", shellId)
            .put("size", JSONObject().put("col", columns).put("row", rows).put("width", width).put("height", height)))
    }

    fun releaseSession(session: SessionModel) {
        scope.launch { closeSession(session) }
        session.sshShellId?.let { client?.closeBinaryChannel(it) }
    }

    suspend fun closeSession(session: com.nashaofu.shell360.core.data.SessionModel) {
        session.sshShellId?.let {
            runCatching { invoke("ssh.shell.close", JSONObject().put("sshShellId", it)) }
        }
        session.sshSftpId?.let {
            runCatching { invoke("ssh.sftp.close", JSONObject().put("sshSftpId", it)) }
        }
        runCatching { invoke("ssh.session.disconnect", JSONObject().put("sshSessionId", session.id)) }
    }

    suspend fun resetCrypto() {
        invoke("data.resetCrypto")
        Shell360Store.reset()
        Shell360Store.runtimeReady = true
    }

    private suspend fun loadData(runtime: NativeRuntimeClient, context: Context?) {
        val hosts = runtime.invoke("data.getHosts").arrayValue()
        Shell360Store.hosts.clear()
        for (index in 0 until hosts.length()) hosts.optJSONObject(index)?.let { Shell360Store.hosts.add(it.toHost()) }

        val keys = runtime.invoke("data.getKeys").arrayValue()
        Shell360Store.keys.clear()
        for (index in 0 until keys.length()) keys.optJSONObject(index)?.let { Shell360Store.keys.add(it.toKey()) }

        val tunnels = runtime.invoke("data.getPortForwardings").arrayValue()
        Shell360Store.tunnels.clear()
        for (index in 0 until tunnels.length()) tunnels.optJSONObject(index)?.let { Shell360Store.tunnels.add(it.toTunnel()) }

        val knownHostsFile = context?.let { File(it.filesDir, "shell360/known_hosts") }
        val lines = knownHostsFile?.takeIf(File::isFile)?.readLines().orEmpty()
        Shell360Store.knownHosts.clear()
        lines.forEach { line ->
            val parts = line.trim().split(Regex("\\s+"))
            if (parts.size >= 3 && !parts[0].startsWith("#")) {
                val marked = parts[0].startsWith("@")
                val offset = if (marked) 1 else 0
                if (parts.size >= offset + 3) Shell360Store.knownHosts.add(
                    KnownHostModel(
                        marker = if (marked) parts[0] else "",
                        host = parts[offset],
                        type = parts[offset + 1],
                        key = parts[offset + 2],
                    ),
                )
            }
        }
    }

    private fun appContextOrThrow(): Context = requireNotNull(appContext) { "Android runtime is not initialized." }

    fun deleteKnownHost(item: KnownHostModel) {
        val context = appContext ?: return
        val file = File(context.filesDir, "shell360/known_hosts")
        if (file.isFile) {
            val lines = file.readLines()
            file.writeText(lines.filterNot { it.trim() == item.rawLine }.joinToString("\n").let { if (it.isEmpty()) "" else "$it\n" })
        }
        Shell360Store.deleteKnownHost(item.id)
    }

    fun exportData(): String = AppDataJson.export()
}

private fun JSONObject.booleanValue(): Boolean = opt("value") as? Boolean ?: false
private fun JSONObject.arrayValue(): JSONArray = opt("value") as? JSONArray ?: JSONArray()

private fun JSONObject.toHost(): HostModel = HostModel(
    id = optString("id"),
    name = if (isNull("name")) "" else optString("name"),
    tags = optJSONArray("tags").strings(),
    hostname = optString("hostname"),
    port = optInt("port", 22),
    username = optString("username"),
    authenticationMethod = runCatching { AuthMethod.valueOf(optString("authenticationMethod")) }.getOrDefault(AuthMethod.Password),
    password = optString("password"),
    keyId = optString("keyId").takeIf { it != "null" }.orEmpty(),
    startupCommand = optString("startupCommand").takeIf { it != "null" }.orEmpty(),
    terminalType = optString("terminalType").ifEmpty { "xterm-256color" },
    envs = optJSONArray("envs").let { values ->
        (0 until (values?.length() ?: 0)).mapNotNull { values?.optJSONObject(it)?.let { item -> EnvVar(item.optString("key"), item.optString("value")) } }
    },
    jumpHostIds = optJSONArray("jumpHostIds").strings(),
    terminalSettings = optJSONObject("terminalSettings")?.let {
        HostTerminalSettings(it.optString("fontFamily"), it.optInt("fontSize", 14), it.optString("theme"))
    } ?: HostTerminalSettings(),
)

private fun JSONObject.toKey(): KeyModel = KeyModel(
    id = optString("id"), name = optString("name"), publicKey = optString("publicKey"),
    privateKey = optString("privateKey"), passphrase = optString("passphrase"), certificate = optString("certificate"),
)

private fun JSONObject.toTunnel(): TunnelModel = TunnelModel(
    id = optString("id"), name = optString("name"),
    type = runCatching { TunnelType.valueOf(optString("portForwardingType")) }.getOrDefault(TunnelType.Local),
    hostId = optString("hostId"), localAddress = optString("localAddress"), localPort = optInt("localPort"),
    remoteAddress = optString("remoteAddress"), remotePort = optInt("remotePort").takeIf { it > 0 },
)

private fun HostModel.toBaseJson(): JSONObject = JSONObject().apply {
    if (id.toLongOrNull() != null) put("id", id)
    put("name", name.ifBlank { JSONObject.NULL })
    put("tags", JSONArray(tags))
    put("hostname", hostname)
    put("port", port)
    put("username", username)
    put("authenticationMethod", authenticationMethod.name)
    put("password", password.ifBlank { JSONObject.NULL })
    put("keyId", keyId.toLongOrNull()?.toString() ?: JSONObject.NULL)
    put("startupCommand", startupCommand.ifBlank { JSONObject.NULL })
    put("terminalType", terminalType.ifBlank { JSONObject.NULL })
    put("envs", JSONArray().apply { envs.forEach { put(JSONObject().put("key", it.key).put("value", it.value)) } })
    put("jumpHostIds", JSONArray(jumpHostIds.mapNotNull { it.toLongOrNull()?.toString() }))
    put("terminalSettings", JSONObject()
        .put("fontFamily", terminalSettings.fontFamily)
        .put("fontSize", terminalSettings.fontSize)
        .put("theme", terminalSettings.theme))
}

private fun KeyModel.toBaseJson(): JSONObject = JSONObject()
    .put("name", name)
    .put("privateKey", privateKey)
    .put("publicKey", publicKey)
    .put("passphrase", passphrase.ifBlank { JSONObject.NULL })
    .put("certificate", certificate.ifBlank { JSONObject.NULL })

private fun TunnelModel.toBaseJson(): JSONObject = JSONObject()
    .put("name", name)
    .put("portForwardingType", type.name)
    .put("hostId", hostId.toLongOrNull()?.toString() ?: error("Tunnel host ID is invalid."))
    .put("localAddress", localAddress)
    .put("localPort", localPort)
    .put("remoteAddress", remoteAddress.ifBlank { JSONObject.NULL })
    .put("remotePort", remotePort ?: JSONObject.NULL)

private fun JSONArray?.strings(): List<String> = (0 until (this?.length() ?: 0)).mapNotNull { this?.optString(it) }
