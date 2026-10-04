package com.nashaofu.shell360.feature.terminal

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus

class TerminalViewModel {
    var uiState: TerminalUiState by mutableStateOf(TerminalUiState())
        private set

    fun syncSession(session: SessionModel) {
        val status = when (session.status) {
            SessionStatus.Pending -> TerminalStatus.Connecting
            SessionStatus.Success -> TerminalStatus.Connected
            SessionStatus.Failed -> TerminalStatus.Error
        }
        if (uiState.status != status ||
            uiState.errorMessage != session.error ||
            uiState.errorCode != session.errorCode ||
            uiState.errorType != session.errorType
        ) {
            uiState = uiState.copy(
                status = status,
                errorMessage = session.error,
                errorCode = session.errorCode,
                errorType = session.errorType,
            )
        }
    }

    fun onAction(action: TerminalAction) {
        uiState = when (action) {
            is TerminalAction.VirtualKey -> uiState.copy(inputLine = uiState.inputLine + action.data)
            TerminalAction.ToggleKeyboard ->
                uiState.copy(virtualKeyboardVisible = !uiState.virtualKeyboardVisible)

            TerminalAction.ClearInput -> uiState.copy(inputLine = "")
            TerminalAction.Retry -> uiState.copy(status = TerminalStatus.Connecting, errorMessage = null)
            TerminalAction.ConnectionTimedOut -> uiState.copy(
                status = TerminalStatus.Error,
                errorType = "timeout",
                errorMessage = "Connection timed out. Check the host, port, and network, then retry.",
            )
            TerminalAction.MarkConnected -> uiState.copy(status = TerminalStatus.Connected, errorMessage = null)
            is TerminalAction.AuthMethodChanged -> uiState.copy(authMethod = action.method)
            is TerminalAction.AuthPasswordChanged -> uiState.copy(
                authPassword = action.value.take(MAX_AUTH_PASSWORD_LENGTH),
            )

            is TerminalAction.AuthKeyChanged -> uiState.copy(authKeyId = action.keyId)
            is TerminalAction.KeyboardAnswerChanged -> uiState.copy(keyboardAnswer = action.value)
        }
    }
}

/** Mirrors the `maxLength={100}` on the reference authentication password field. */
const val MAX_AUTH_PASSWORD_LENGTH = 100

/** Renders control characters so the pending input stays readable in the native surface. */
fun escapeForDisplay(data: String): String = buildString {
    for (char in data) {
        when (char) {
            '\u001b' -> append("^[")
            '\t' -> append("^I")
            '\r' -> append("^M")
            '\n' -> append("\\n")
            else -> append(char)
        }
    }
}
