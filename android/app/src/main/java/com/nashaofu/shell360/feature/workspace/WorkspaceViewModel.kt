package com.nashaofu.shell360.feature.workspace

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.Shell360Store

class WorkspaceViewModel {
    var uiState: WorkspaceUiState by mutableStateOf(WorkspaceUiState())
        private set

    /** Mirrors the webview behaviour: drop to the next session, or clear when none remain. */
    fun ensureActive() {
        val sessions = Shell360Store.sessions
        if (sessions.isEmpty()) {
            if (uiState.activeSessionId != null) {
                uiState = uiState.copy(activeSessionId = null, isSessionPickerOpen = false)
            }
            return
        }
        if (sessions.none { it.id == uiState.activeSessionId }) {
            uiState = uiState.copy(activeSessionId = sessions.first().id)
        }
    }

    fun onAction(action: WorkspaceAction) {
        uiState = when (action) {
            WorkspaceAction.SessionPickerOpened -> uiState.copy(isSessionPickerOpen = true)
            WorkspaceAction.SessionPickerClosed -> uiState.copy(isSessionPickerOpen = false)
            is WorkspaceAction.SessionSelected -> uiState.copy(
                activeSessionId = action.sessionId,
                isSessionPickerOpen = false,
            )

            is WorkspaceAction.SessionClosed -> {
                Shell360Store.closeSession(action.sessionId)
                val next = if (action.sessionId == uiState.activeSessionId) {
                    Shell360Store.sessions.firstOrNull()?.id
                } else {
                    uiState.activeSessionId
                }
                uiState.copy(activeSessionId = next)
            }

            WorkspaceAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}
