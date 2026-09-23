package com.nashaofu.shell360.feature.settings

import com.nashaofu.shell360.ui.theme.ThemeMode

sealed interface SettingsAction {
    data class ThemeSelected(val value: ThemeMode) : SettingsAction
    data object ExportClicked : SettingsAction
    data object ImportClicked : SettingsAction
    data object CryptoToggleClicked : SettingsAction
    data object ResetClicked : SettingsAction
    data object ConfirmImport : SettingsAction
    data object ConfirmReset : SettingsAction
    data object PrivacyPolicyClicked : SettingsAction
    data object AboutClicked : SettingsAction
    data object DialogDismissed : SettingsAction
    data object FeedbackDismissed : SettingsAction
}
