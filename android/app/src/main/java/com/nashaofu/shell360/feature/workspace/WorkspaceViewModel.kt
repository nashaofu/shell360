package com.nashaofu.shell360.feature.workspace

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class WorkspaceViewModel {
    var uiState: WorkspaceUiState by mutableStateOf(WorkspaceUiState())
        private set

    val activeSession: WorkspaceSession?
        get() = uiState.sessions.firstOrNull { it.id == uiState.activeSessionId }

    fun onAction(action: WorkspaceAction) {
        uiState = when (action) {
            WorkspaceAction.SessionPickerOpened -> uiState.copy(isSessionPickerOpen = true)
            WorkspaceAction.SessionPickerClosed -> uiState.copy(isSessionPickerOpen = false)
            is WorkspaceAction.SessionSelected -> uiState.copy(activeSessionId = action.sessionId, isSessionPickerOpen = false)
            WorkspaceAction.HostsRequested -> uiState.copy(feedbackMessage = "Open a Terminal or SFTP session from Hosts.")
            WorkspaceAction.CloseSessionRequested -> uiState.copy(feedbackMessage = "Session runtime is not connected on Android yet.")
            WorkspaceAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}
