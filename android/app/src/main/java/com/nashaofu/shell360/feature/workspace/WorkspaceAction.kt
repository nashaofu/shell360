package com.nashaofu.shell360.feature.workspace

sealed interface WorkspaceAction {
    data object SessionPickerOpened : WorkspaceAction
    data object SessionPickerClosed : WorkspaceAction
    data class SessionSelected(val sessionId: String) : WorkspaceAction
    data object HostsRequested : WorkspaceAction
    data object CloseSessionRequested : WorkspaceAction
    data object FeedbackDismissed : WorkspaceAction
}
