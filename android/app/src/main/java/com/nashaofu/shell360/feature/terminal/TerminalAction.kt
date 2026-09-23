package com.nashaofu.shell360.feature.terminal

sealed interface TerminalAction {
    data object Retry : TerminalAction
    data object ToggleKeyboard : TerminalAction
    data object Close : TerminalAction
}
