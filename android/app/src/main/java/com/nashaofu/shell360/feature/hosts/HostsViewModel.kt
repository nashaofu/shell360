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

data class HostsUiState(
    val hosts: List<HostItem> = emptyList(),
    val query: String = "",
    val selectedTag: String? = null,
    val editorHost: HostItem? = null,
    val isEditorOpen: Boolean = false,
)

class HostsViewModel {
    var uiState by mutableStateOf(HostsUiState())
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

    fun setQuery(query: String) {
        uiState = uiState.copy(query = query)
    }

    fun setSelectedTag(tag: String?) {
        uiState = uiState.copy(selectedTag = tag)
    }

    fun openEditor(host: HostItem? = null) {
        uiState = uiState.copy(editorHost = host, isEditorOpen = true)
    }

    fun closeEditor() {
        uiState = uiState.copy(editorHost = null, isEditorOpen = false)
    }

    fun saveHost(host: HostItem) {
        val updated = uiState.hosts.toMutableList()
        val index = updated.indexOfFirst { it.id == host.id }
        if (index >= 0) updated[index] = host else updated.add(host)
        uiState = uiState.copy(hosts = updated, editorHost = null, isEditorOpen = false)
    }

    fun deleteHost(host: HostItem) {
        uiState = uiState.copy(hosts = uiState.hosts.filterNot { it.id == host.id })
    }
}
