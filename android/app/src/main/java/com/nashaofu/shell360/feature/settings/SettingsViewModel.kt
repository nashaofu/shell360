package com.nashaofu.shell360.feature.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.AppPrefs
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.ui.theme.ThemePreferences
import kotlinx.coroutines.launch

class SettingsViewModel {
    var uiState: SettingsUiState by mutableStateOf(SettingsUiState())
        private set

    fun onAction(action: SettingsAction) {
        uiState = when (action) {
            is SettingsAction.ThemeSelected -> {
                ThemePreferences.mode = action.value
                AppPrefs.setThemeMode(action.value.name)
                uiState.copy(themeMode = action.value)
            }

            SettingsAction.ExportRequested -> uiState
            SettingsAction.ImportRequested -> uiState

            is SettingsAction.CryptoEnableChanged -> {
                if (action.value) {
                    uiState.copy(isInitCryptoOpen = true)
                } else {
                    AndroidRuntime.scope.launch {
                        runCatching { AndroidRuntime.disableCrypto() }
                            .onFailure { uiState = uiState.copy(feedbackMessage = it.message ?: "Could not disable encryption") }
                            .onSuccess { uiState = uiState.copy(cryptoEnabled = false, feedbackMessage = "Encryption disabled") }
                    }
                    uiState
                }
            }

            SettingsAction.InitCryptoDismissed -> uiState.copy(isInitCryptoOpen = false)

            is SettingsAction.InitCryptoSubmitted -> {
                val password = action.password
                when {
                    password.length < CRYPTO_PASSWORD_MIN_LENGTH ->
                        uiState.copy(
                            isInitCryptoOpen = false,
                            feedbackMessage = "Please enter at least $CRYPTO_PASSWORD_MIN_LENGTH characters",
                        )

                    password.length > CRYPTO_PASSWORD_MAX_LENGTH ->
                        uiState.copy(
                            isInitCryptoOpen = false,
                            feedbackMessage = "Please enter no more than $CRYPTO_PASSWORD_MAX_LENGTH characters",
                        )

                    else -> {
                        AndroidRuntime.scope.launch {
                            runCatching { AndroidRuntime.setCryptoPassword(password, password) }
                                .onFailure {
                                    uiState = uiState.copy(isInitCryptoOpen = false, feedbackMessage = it.message ?: "Encryption initialization failed")
                                }
                                .onSuccess {
                                    uiState = uiState.copy(cryptoEnabled = true, isInitCryptoOpen = false, feedbackMessage = "Initialization of crypto success")
                                }
                        }
                        uiState
                    }
                }
            }

            SettingsAction.ChangePasswordDismissed -> uiState.copy(isChangePasswordOpen = false)

            is SettingsAction.ChangePasswordSubmitted -> when {
                action.newPassword.length < CRYPTO_PASSWORD_MIN_LENGTH ->
                    uiState.copy(
                        isChangePasswordOpen = false,
                        feedbackMessage = "Please enter at least $CRYPTO_PASSWORD_MIN_LENGTH characters",
                    )

                action.newPassword.length > CRYPTO_PASSWORD_MAX_LENGTH ->
                    uiState.copy(
                        isChangePasswordOpen = false,
                        feedbackMessage = "Please enter no more than $CRYPTO_PASSWORD_MAX_LENGTH characters",
                    )

                else -> {
                    AndroidRuntime.scope.launch {
                        runCatching { AndroidRuntime.changeCryptoPassword(action.oldPassword, action.newPassword, action.newPassword) }
                            .onFailure {
                                uiState = uiState.copy(isChangePasswordOpen = false, feedbackMessage = it.message ?: "Change crypto password failed")
                            }
                            .onSuccess { uiState = uiState.copy(isChangePasswordOpen = false, feedbackMessage = "Change crypto password success") }
                    }
                    uiState
                }
            }

            is SettingsAction.Feedback -> uiState.copy(feedbackMessage = action.message)
            SettingsAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }

    fun openChangePassword() {
        uiState = uiState.copy(isChangePasswordOpen = true)
    }
}
