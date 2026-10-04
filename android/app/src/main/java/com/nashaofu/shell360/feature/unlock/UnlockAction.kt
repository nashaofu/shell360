package com.nashaofu.shell360.feature.unlock

sealed interface UnlockAction {
    data class PasswordChanged(val value: String) : UnlockAction
    data object UnlockClicked : UnlockAction
    data object ResetClicked : UnlockAction
    data object ResetDismissed : UnlockAction
    data object ResetConfirmed : UnlockAction
    data object FeedbackDismissed : UnlockAction
}
