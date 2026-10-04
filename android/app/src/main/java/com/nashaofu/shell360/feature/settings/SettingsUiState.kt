package com.nashaofu.shell360.feature.settings

import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.ui.theme.ThemeMode
import com.nashaofu.shell360.ui.theme.ThemePreferences

const val CRYPTO_PASSWORD_MIN_LENGTH = 8
const val CRYPTO_PASSWORD_MAX_LENGTH = 128

data class SettingsUiState(
    val themeMode: ThemeMode = ThemePreferences.mode,
    val cryptoEnabled: Boolean = Shell360Store.cryptoEnabled,
    val isInitCryptoOpen: Boolean = false,
    val isChangePasswordOpen: Boolean = false,
    val feedbackMessage: String? = null,
)
