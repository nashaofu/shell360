package com.nashaofu.shell360.feature.unlock

data class UnlockUiState(
    val password: String = "",
    val isLoading: Boolean = false,
    val isResetConfirmOpen: Boolean = false,
    val feedbackMessage: String? = null,
)
