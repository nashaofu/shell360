package com.nashaofu.shell360.feature.unlock

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import kotlinx.coroutines.launch

class UnlockViewModel {
    var uiState: UnlockUiState by mutableStateOf(UnlockUiState())
        private set

    fun onAction(action: UnlockAction) {
        uiState = when (action) {
            is UnlockAction.PasswordChanged -> uiState.copy(password = action.value)
            UnlockAction.UnlockClicked -> {
                if (uiState.password.isEmpty()) {
                    uiState.copy(isLoading = false, feedbackMessage = "Please enter the password")
                } else {
                    val password = uiState.password
                    uiState = uiState.copy(isLoading = true, feedbackMessage = null)
                    AndroidRuntime.scope.launch {
                        runCatching { AndroidRuntime.unlock(password) }
                            .onFailure {
                                uiState = uiState.copy(isLoading = false, feedbackMessage = it.message ?: "Unlock failed, please confirm the password is correct")
                            }
                            .onSuccess { uiState = uiState.copy(isLoading = false, feedbackMessage = null) }
                    }
                    uiState
                }
            }

            UnlockAction.ResetClicked -> uiState.copy(isResetConfirmOpen = true)
            UnlockAction.ResetDismissed -> uiState.copy(isResetConfirmOpen = false)
            UnlockAction.ResetConfirmed -> {
                AndroidRuntime.scope.launch {
                    runCatching { AndroidRuntime.resetCrypto() }
                        .onFailure { uiState = uiState.copy(isResetConfirmOpen = false, feedbackMessage = it.message ?: "Could not reset encrypted storage") }
                        .onSuccess { uiState = uiState.copy(isResetConfirmOpen = false, feedbackMessage = null) }
                }
                uiState
            }

            UnlockAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}
