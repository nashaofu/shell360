package com.nashaofu.shell360.feature.terminal

import com.nashaofu.shell360.core.data.AuthMethod

enum class TerminalStatus { Connecting, Connected, Error }

data class TerminalUiState(
    val status: TerminalStatus = TerminalStatus.Connecting,
    val errorMessage: String? = null,
    val errorCode: String? = null,
    val errorType: String? = null,
    val virtualKeyboardVisible: Boolean = false,
    val applicationCursorKeysMode: Boolean = false,
    val inputLine: String = "",
    val authMethod: AuthMethod = AuthMethod.Password,
    val authPassword: String = "",
    val authKeyId: String = "",
    val keyboardAnswer: String = "",
)
