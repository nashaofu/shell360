package com.nashaofu.shell360.feature.hosts

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

data class HostItem(
    val id: String,
    val name: String,
    val hostname: String,
    val username: String,
    val port: Int,
    val tags: List<String> = emptyList(),
)

class HostsViewModel {
    var uiState: HostsUiState by mutableStateOf(HostsUiState())
        private set

    val visibleHosts: List<HostItem>
        get() {
            val query = uiState.query.trim().lowercase()
            return uiState.hosts.filter { host ->
                val matchesTag = uiState.selectedTag == null || uiState.selectedTag in host.tags
                val matchesQuery = query.isEmpty() || listOf(
                    host.name,
                    host.hostname,
                    host.username,
                    host.tags.joinToString(" "),
                    "${host.hostname}:${host.port}",
                ).any { it.lowercase().contains(query) }
                matchesTag && matchesQuery
            }
        }

    val tags: List<String>
        get() = uiState.hosts.flatMap { it.tags }.distinct().sorted()

    fun onAction(action: HostsAction) {
        uiState = when (action) {
            is HostsAction.QueryChanged -> uiState.copy(query = action.value)
            is HostsAction.TagSelected -> uiState.copy(selectedTag = action.value)
            HostsAction.AddClicked -> uiState.copy(editorHost = null, isEditorOpen = true)
            is HostsAction.EditClicked -> uiState.copy(editorHost = action.host, isEditorOpen = true)
            is HostsAction.DuplicateClicked -> uiState.copy(
                editorHost = action.host.copy(id = "", name = "${action.host.name} Copy"),
                isEditorOpen = true,
            )
            is HostsAction.DeleteClicked -> uiState.copy(deleteTarget = action.host)
            HostsAction.DeleteDismissed -> uiState.copy(deleteTarget = null)
            HostsAction.DeleteConfirmed -> uiState.deleteTarget?.let {
                uiState.copy(
                    deleteTarget = null,
                    feedbackMessage = "Hosts storage is not connected on Android yet.",
                )
            } ?: uiState
            HostsAction.EditorDismissed -> uiState.copy(editorHost = null, isEditorOpen = false)
            is HostsAction.HostSaved -> {
                uiState.copy(
                    editorHost = null,
                    isEditorOpen = false,
                    feedbackMessage = "Hosts storage is not connected on Android yet.",
                )
            }
            HostsAction.ClearFiltersClicked -> uiState.copy(query = "", selectedTag = null)
            is HostsAction.ConnectionRequested -> uiState.copy(feedbackMessage = "${action.protocol} runtime is not connected on Android yet.")
        }
    }

    fun dismissFeedback() {
        uiState = uiState.copy(feedbackMessage = null)
    }
}
