package com.nashaofu.shell360.feature.terminal

import com.nashaofu.shell360.core.data.AuthMethod

sealed interface TerminalAction {
    data class VirtualKey(val data: String) : TerminalAction
    data object ToggleKeyboard : TerminalAction
    data object ClearInput : TerminalAction
    data object Retry : TerminalAction
    data object ConnectionTimedOut : TerminalAction
    data object MarkConnected : TerminalAction

    /** Authentication form edits, mirroring `AuthenticationError/AuthenticationForm.tsx`. */
    data class AuthMethodChanged(val method: AuthMethod) : TerminalAction
    data class AuthPasswordChanged(val value: String) : TerminalAction
    data class AuthKeyChanged(val keyId: String) : TerminalAction
    data class KeyboardAnswerChanged(val value: String) : TerminalAction
}
