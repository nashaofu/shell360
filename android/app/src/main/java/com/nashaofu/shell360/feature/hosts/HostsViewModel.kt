package com.nashaofu.shell360.feature.hosts

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import kotlinx.coroutines.launch

class HostsViewModel {
    var uiState: HostsUiState by mutableStateOf(HostsUiState())
        private set

    fun onAction(action: HostsAction) {
        uiState = when (action) {
            is HostsAction.QueryChanged -> uiState.copy(query = action.value)
            is HostsAction.TagSelected -> uiState.copy(selectedTag = action.value)
            HostsAction.AddClicked -> uiState.copy(editorHost = null, isEditorOpen = true)
            is HostsAction.EditClicked -> uiState.copy(editorHost = action.host, isEditorOpen = true)
            is HostsAction.DuplicateClicked -> {
                val copy = Shell360Store.duplicateHost(action.host)
                uiState.copy(editorHost = copy, isEditorOpen = true)
            }

            is HostsAction.DeleteClicked -> uiState.copy(deleteTarget = action.host)
            HostsAction.DeleteDismissed -> uiState.copy(deleteTarget = null)
            HostsAction.DeleteConfirmed -> {
                val target = uiState.deleteTarget
                if (target != null) AndroidRuntime.scope.launch {
                    runCatching { AndroidRuntime.deleteHost(target) }
                        .onSuccess { Shell360Store.deleteHost(target.id) }
                        .onFailure { uiState = uiState.copy(feedbackMessage = it.message ?: "Could not delete host") }
                }
                uiState.copy(deleteTarget = null)
            }

            HostsAction.EditorDismissed -> uiState.copy(editorHost = null, isEditorOpen = false)
            HostsAction.ClearFiltersClicked -> uiState.copy(query = "", selectedTag = null)
            HostsAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}
