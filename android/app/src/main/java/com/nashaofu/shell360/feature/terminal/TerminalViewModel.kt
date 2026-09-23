package com.nashaofu.shell360.feature.terminal

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class TerminalViewModel {
    var uiState: TerminalUiState by mutableStateOf(TerminalUiState())
        private set

    fun onAction(action: TerminalAction) {
        uiState = when (action) {
            TerminalAction.Retry -> uiState.copy(status = TerminalStatus.Connecting, errorMessage = "Terminal runtime is not connected on Android yet.")
            TerminalAction.ToggleKeyboard -> uiState.copy(virtualKeyboardVisible = !uiState.virtualKeyboardVisible)
            TerminalAction.Close -> uiState.copy(errorMessage = "Closing a Terminal session requires the Android SessionStore.")
        }
    }
}
