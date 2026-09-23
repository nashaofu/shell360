package com.nashaofu.shell360.feature.workspace

enum class WorkspaceSessionType { Terminal, Sftp }

enum class WorkspaceSessionStatus { Connecting, Connected, Disconnected, Error }

data class WorkspaceSession(
    val id: String,
    val title: String,
    val type: WorkspaceSessionType,
    val status: WorkspaceSessionStatus,
    val context: String,
)

data class WorkspaceUiState(
    val sessions: List<WorkspaceSession> = emptyList(),
    val activeSessionId: String? = null,
    val isSessionPickerOpen: Boolean = false,
    val feedbackMessage: String? = null,
)
