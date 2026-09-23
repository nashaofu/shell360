package com.nashaofu.shell360.feature.terminal

enum class TerminalStatus { Connecting, Connected, Error }

data class TerminalUiState(
    val status: TerminalStatus = TerminalStatus.Connecting,
    val errorMessage: String? = "Terminal runtime is not connected on Android yet.",
    val virtualKeyboardVisible: Boolean = false,
)
