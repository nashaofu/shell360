package com.nashaofu.shell360.feature.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.ui.theme.ThemePreferences

class SettingsViewModel {
    var uiState: SettingsUiState by mutableStateOf(SettingsUiState(themeMode = ThemePreferences.mode))
        private set

    fun onAction(action: SettingsAction) {
        uiState = when (action) {
            is SettingsAction.ThemeSelected -> {
                ThemePreferences.mode = action.value
                uiState.copy(themeMode = action.value)
            }
            SettingsAction.ExportClicked -> uiState.copy(feedbackMessage = "Export is not connected on Android yet.")
            SettingsAction.ImportClicked -> uiState.copy(dialog = SettingsDialog.Import)
            SettingsAction.CryptoToggleClicked -> uiState.copy(feedbackMessage = "Security settings are not connected on Android yet.")
            SettingsAction.ResetClicked -> uiState.copy(dialog = SettingsDialog.Reset)
            SettingsAction.ConfirmImport -> uiState.copy(dialog = null, feedbackMessage = "Import is not connected on Android yet.")
            SettingsAction.ConfirmReset -> uiState.copy(dialog = null, feedbackMessage = "Reset is not connected on Android yet.")
            SettingsAction.PrivacyPolicyClicked -> uiState.copy(feedbackMessage = "Privacy Policy link is not connected on Android yet.")
            SettingsAction.AboutClicked -> uiState.copy(feedbackMessage = "About page is not connected on Android yet.")
            SettingsAction.DialogDismissed -> uiState.copy(dialog = null)
            SettingsAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}
