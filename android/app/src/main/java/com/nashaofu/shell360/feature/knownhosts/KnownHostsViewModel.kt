package com.nashaofu.shell360.feature.knownhosts

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class KnownHostsViewModel {
    var uiState: KnownHostsUiState by mutableStateOf(KnownHostsUiState())
        private set

    val visibleItems: List<KnownHostItem>
        get() {
            val query = uiState.query.trim().lowercase()
            return uiState.items.filter { item ->
                query.isEmpty() || listOf(item.host, item.type, item.fingerprint, item.marker.orEmpty()).any { it.lowercase().contains(query) }
            }
        }

    fun onAction(action: KnownHostsAction) {
        uiState = when (action) {
            is KnownHostsAction.QueryChanged -> uiState.copy(query = action.value)
            is KnownHostsAction.DeleteClicked -> uiState.copy(pendingDelete = action.item)
            KnownHostsAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }

    fun confirmDelete() {
        if (uiState.pendingDelete == null) return
        uiState = uiState.copy(
            pendingDelete = null,
            feedbackMessage = "Known Hosts storage is not connected on Android yet.",
        )
    }

    fun cancelDelete() {
        uiState = uiState.copy(pendingDelete = null)
    }
}
