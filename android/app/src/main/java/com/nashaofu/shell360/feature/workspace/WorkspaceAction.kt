package com.nashaofu.shell360.feature.workspace

sealed interface WorkspaceAction {
    data object SessionPickerOpened : WorkspaceAction
    data object SessionPickerClosed : WorkspaceAction
    data class SessionSelected(val sessionId: String) : WorkspaceAction
    data class SessionClosed(val sessionId: String) : WorkspaceAction
    data object FeedbackDismissed : WorkspaceAction
}
