package com.nashaofu.shell360.core.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.setValue

/**
 * Session-scoped in-memory state that backs the native UI. Replacing the bodies of
 * these operations with the Rust/bridge data layer keeps every screen unchanged.
 */
object Shell360Store {
    val hosts = mutableStateListOf<HostModel>()
    val keys = mutableStateListOf<KeyModel>()
    val knownHosts = mutableStateListOf<KnownHostModel>()
    val tunnels = mutableStateListOf<TunnelModel>()
    val sessions = mutableStateListOf<SessionModel>()
    val runningTunnels = mutableStateListOf<String>()
    val tunnelErrors = mutableStateMapOf<String, String>()

    var cryptoEnabled by mutableStateOf(false)
    var cryptoPassword by mutableStateOf("")
    var authed by mutableStateOf(true)
    var runtimeReady by mutableStateOf(false)
    var runtimeError by mutableStateOf<String?>(null)
    var version by mutableStateOf("1.0.0-native")

    /**
     * False until the process has restored persisted settings. Guards against an
     * Activity recreation (rotation, window resize) re-locking the app.
     */
    var initialized by mutableStateOf(false)

    fun hostById(id: String): HostModel? = hosts.firstOrNull { it.id == id }

    fun hostTitle(id: String): String = hostById(id)?.title ?: id

    fun addHost(host: HostModel): HostModel {
        hosts.add(host)
        return host
    }

    fun saveHost(host: HostModel) {
        val index = hosts.indexOfFirst { it.id == host.id }
        if (index >= 0) hosts[index] = host else hosts.add(host)
    }

    fun deleteHost(id: String) {
        hosts.removeAll { it.id == id }
        tunnels.removeAll { it.hostId == id }
    }

    fun duplicateHost(host: HostModel): HostModel {
        val copy = host.copy(id = newId(), name = "${host.title} Copy")
        hosts.add(copy)
        return copy
    }

    fun addKey(key: KeyModel): KeyModel {
        keys.add(key)
        return key
    }

    fun saveKey(key: KeyModel) {
        val index = keys.indexOfFirst { it.id == key.id }
        if (index >= 0) keys[index] = key else keys.add(key)
    }

    fun deleteKey(id: String) {
        keys.removeAll { it.id == id }
    }

    fun duplicateKey(key: KeyModel): KeyModel {
        val copy = key.copy(id = newId(), name = "${key.name} Copy")
        keys.add(copy)
        return copy
    }

    fun deleteKnownHost(id: String) {
        knownHosts.removeAll { it.id == id }
    }

    fun saveTunnel(tunnel: TunnelModel) {
        val index = tunnels.indexOfFirst { it.id == tunnel.id }
        if (index >= 0) tunnels[index] = tunnel else tunnels.add(tunnel)
    }

    fun deleteTunnel(id: String) {
        tunnels.removeAll { it.id == id }
        runningTunnels.remove(id)
    }

    fun isTunnelRunning(id: String): Boolean = runningTunnels.contains(id)

    fun startTunnel(id: String) {
        tunnelErrors.remove(id)
        if (!runningTunnels.contains(id)) runningTunnels.add(id)
    }

    fun stopTunnel(id: String) {
        runningTunnels.remove(id)
    }

    fun setTunnelError(id: String, message: String) {
        runningTunnels.remove(id)
        tunnelErrors[id] = message
    }

    fun setTunnelError(id: String, message: String) {
        runningTunnels.remove(id)
        tunnelErrors[id] = message
    }

    fun sessionById(id: String): SessionModel? = sessions.firstOrNull { it.id == id }

    /**
     * Mirrors `addTerminalOfType` in `packages/shared/src/atoms/session.atom.ts`:
     * the base name never carries a type suffix, and a terminal counts every session of
     * the same host while an SFTP session only counts other SFTP sessions.
     */
    fun openSession(host: HostModel, kind: SessionKind): SessionModel {
        val count = sessions.count { session ->
            session.hostId == host.id && (kind != SessionKind.Sftp || session.kind == SessionKind.Sftp)
        }
        val name = if (count == 0) host.title else "${host.title} ($count)"
        val session = SessionModel(name = name, kind = kind, hostId = host.id)
        sessions.add(session)
        return session
    }

    fun retrySession(id: String) {
        val index = sessions.indexOfFirst { it.id == id }
        if (index >= 0) {
            sessions[index] = sessions[index].copy(status = SessionStatus.Pending, error = null)
        }
    }

    fun updateSession(session: SessionModel) {
        val index = sessions.indexOfFirst { it.id == session.id }
        if (index >= 0) sessions[index] = session
    }

    fun closeSession(id: String) {
        sessions.removeAll { it.id == id }
    }

    fun reset() {
        hosts.clear()
        keys.clear()
        knownHosts.clear()
        tunnels.clear()
        sessions.clear()
        runningTunnels.clear()
        tunnelErrors.clear()
        cryptoEnabled = false
        authed = true
        runtimeReady = false
    }
}
