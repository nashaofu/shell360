package com.nashaofu.shell360.feature.settings

import com.nashaofu.shell360.ui.theme.ThemeMode

sealed interface SettingsAction {
    data class ThemeSelected(val value: ThemeMode) : SettingsAction
    data object ExportRequested : SettingsAction
    data object ImportRequested : SettingsAction
    data class CryptoEnableChanged(val value: Boolean) : SettingsAction
    data object InitCryptoDismissed : SettingsAction
    data class InitCryptoSubmitted(val password: String) : SettingsAction
    data object ChangePasswordDismissed : SettingsAction
    data class ChangePasswordSubmitted(
        val oldPassword: String,
        val newPassword: String,
    ) : SettingsAction

    data class Feedback(val message: String) : SettingsAction
    data object FeedbackDismissed : SettingsAction
}
