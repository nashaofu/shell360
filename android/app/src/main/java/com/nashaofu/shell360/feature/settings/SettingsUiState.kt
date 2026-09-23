package com.nashaofu.shell360.feature.settings

import com.nashaofu.shell360.ui.theme.ThemeMode

enum class SettingsDialog {
    Import,
    Reset,
}

data class SettingsUiState(
    val themeMode: ThemeMode = ThemeMode.System,
    val cryptoEnabled: Boolean = false,
    val dialog: SettingsDialog? = null,
    val feedbackMessage: String? = null,
)
