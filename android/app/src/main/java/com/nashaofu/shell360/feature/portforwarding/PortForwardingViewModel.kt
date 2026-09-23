package com.nashaofu.shell360.feature.portforwarding

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class PortForwardingViewModel {
    var uiState: PortForwardingUiState by mutableStateOf(PortForwardingUiState())
        private set

    val visibleItems: List<PortForwardingItem>
        get() {
            val query = uiState.query.trim().lowercase()
            return uiState.items.filter { item ->
                query.isEmpty() || listOf(
                    item.name,
                    item.type.label,
                    item.hostId,
                    "${item.localAddress}:${item.localPort}",
                    "${item.remoteAddress}:${item.remotePort ?: ""}",
                ).any { it.lowercase().contains(query) }
            }
        }

    fun onAction(action: PortForwardingAction) {
        uiState = when (action) {
            is PortForwardingAction.QueryChanged -> uiState.copy(query = action.value)
            PortForwardingAction.AddClicked -> uiState.copy(editorItem = null, isEditorOpen = true)
            is PortForwardingAction.EditClicked -> uiState.copy(editorItem = action.item, isEditorOpen = true)
            is PortForwardingAction.DeleteClicked -> uiState.copy(pendingDelete = action.item)
            PortForwardingAction.EditorDismissed -> uiState.copy(editorItem = null, isEditorOpen = false)
            is PortForwardingAction.Saved -> {
                uiState.copy(
                    editorItem = null,
                    isEditorOpen = false,
                    feedbackMessage = "Port Forwarding storage is not connected on Android yet.",
                )
            }
            is PortForwardingAction.RuntimeRequested -> uiState.copy(
                feedbackMessage = "Port Forwarding runtime is not connected on Android yet.",
            )
            PortForwardingAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }

    fun confirmDelete() {
        if (uiState.pendingDelete == null) return
        uiState = uiState.copy(
            pendingDelete = null,
            feedbackMessage = "Port Forwarding storage is not connected on Android yet.",
        )
    }

    fun cancelDelete() {
        uiState = uiState.copy(pendingDelete = null)
    }
}
