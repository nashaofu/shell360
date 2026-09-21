package com.nashaofu.shell360.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.nashaofu.shell360.nativeui.NativeHost
import com.nashaofu.shell360.nativeui.NativeSftpSession
import com.nashaofu.shell360.nativeui.NativeSshSession
import com.nashaofu.shell360.terminal.NativeTerminalSession
enum class WorkspaceSessionState {
    Connecting,
    VerifyingHost,
    Authenticating,
    Connected,
    Disconnected,
    Error,
    Cancelled,
    Closing,
    Closed,
}

data class ActiveTerminalSession(
    val host: NativeHost,
    val ssh: NativeSshSession,
    val terminal: NativeTerminalSession,
    val state: WorkspaceSessionState = WorkspaceSessionState.Connected,
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val lastActiveAt: Long = createdAt,
)

data class ActiveSftpSession(
    val host: NativeHost,
    val ssh: NativeSshSession,
    val sftp: NativeSftpSession,
    val state: WorkspaceSessionState = WorkspaceSessionState.Connected,
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val lastActiveAt: Long = createdAt,
)

data class PendingWorkspaceSession(
    val id: String,
    val host: NativeHost,
    val type: String,
    val state: WorkspaceSessionState = WorkspaceSessionState.Connecting,
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val lastActiveAt: Long = createdAt,
)

/** Owns native session objects independently from individual Compose screens. */
class SessionStore : ViewModel() {
    var activeSessionId: String? by mutableStateOf(null)
        private set
    var pending: List<PendingWorkspaceSession> by mutableStateOf(emptyList())
        private set
    var terminals: List<ActiveTerminalSession> by mutableStateOf(emptyList())
        private set

    var sftps: List<ActiveSftpSession> by mutableStateOf(emptyList())
        private set

    fun addPending(session: PendingWorkspaceSession) {
        pending = pending.filterNot { it.id == session.id } + session
    }

    fun updatePending(id: String, state: WorkspaceSessionState, errorMessage: String? = null) {
        pending = pending.map { if (it.id == id) it.copy(state = state, errorMessage = errorMessage) else it }
    }

    fun removePending(id: String) {
        pending = pending.filterNot { it.id == id }
    }

    fun addTerminal(session: ActiveTerminalSession) {
        terminals = terminals.filterNot { it.ssh.id == session.ssh.id } + session
        activeSessionId = session.ssh.id
    }

    fun addSftp(session: ActiveSftpSession) {
        sftps = sftps.filterNot { it.ssh.id == session.ssh.id } + session
        activeSessionId = session.ssh.id
    }

    fun selectSession(sessionId: String) {
        val now = System.currentTimeMillis()
        val terminal = terminalFor(sessionId)
        val sftp = sftpFor(sessionId)
        if (terminal != null) {
            terminals = terminals.map { if (it.ssh.id == sessionId) it.copy(lastActiveAt = now) else it }
            activeSessionId = sessionId
        } else if (sftp != null) {
            sftps = sftps.map { if (it.ssh.id == sessionId) it.copy(lastActiveAt = now) else it }
            activeSessionId = sessionId
        }
    }

    fun terminalFor(sessionId: String): ActiveTerminalSession? =
        terminals.firstOrNull { it.ssh.id == sessionId }

    fun sftpFor(sessionId: String): ActiveSftpSession? =
        sftps.firstOrNull { it.ssh.id == sessionId }

    fun removeTerminal(sessionId: String): ActiveTerminalSession? {
        val session = terminalFor(sessionId)
        if (session != null) terminals = terminals.filterNot { it.ssh.id == sessionId }
        if (activeSessionId == sessionId) activeSessionId = (terminals.firstOrNull()?.ssh?.id ?: sftps.firstOrNull()?.ssh?.id)
        return session
    }

    fun removeSftp(sessionId: String): ActiveSftpSession? {
        val session = sftpFor(sessionId)
        if (session != null) sftps = sftps.filterNot { it.ssh.id == sessionId }
        if (activeSessionId == sessionId) activeSessionId = (terminals.firstOrNull()?.ssh?.id ?: sftps.firstOrNull()?.ssh?.id)
        return session
    }

    fun closeTerminal(sessionId: String, disconnect: Boolean = true, onDisconnected: () -> Unit = {}) {
        val session = removeTerminal(sessionId) ?: return
        session.terminal.closeShell()
        session.terminal.close()
        if (disconnect) session.ssh.disconnect(onDisconnected) else onDisconnected()
    }

    fun closeSftp(sessionId: String, disconnect: Boolean = true, onDisconnected: () -> Unit = {}) {
        val session = removeSftp(sessionId) ?: return
        session.sftp.close()
        if (disconnect) session.ssh.disconnect(onDisconnected) else onDisconnected()
    }

    fun closeAll(onComplete: () -> Unit = {}) {
        val terminalSessions = terminals
        val sftpSessions = sftps
        terminals = emptyList()
        sftps = emptyList()
        pending = emptyList()
        activeSessionId = null
        terminalSessions.forEach { session ->
            session.terminal.closeShell()
            session.terminal.close()
            session.ssh.disconnect()
        }
        sftpSessions.forEach { session ->
            session.sftp.close()
            session.ssh.disconnect()
        }
        onComplete()
    }

    override fun onCleared() {
        closeAll()
    }
}
