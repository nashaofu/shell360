package com.nashaofu.shell360.feature.knownhosts

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime

class KnownHostsViewModel {
    var uiState: KnownHostsUiState by mutableStateOf(KnownHostsUiState())
        private set

    fun onAction(action: KnownHostsAction) {
        uiState = when (action) {
            is KnownHostsAction.QueryChanged -> uiState.copy(query = action.value)
            is KnownHostsAction.DeleteClicked -> uiState.copy(deleteTarget = action.item)
            KnownHostsAction.DeleteDismissed -> uiState.copy(deleteTarget = null)
            KnownHostsAction.DeleteConfirmed -> {
                uiState.deleteTarget?.let { AndroidRuntime.deleteKnownHost(it) }
                uiState.copy(deleteTarget = null)
            }

            KnownHostsAction.ClearSearchClicked -> uiState.copy(query = "")
            KnownHostsAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}
