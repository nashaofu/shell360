package com.nashaofu.shell360.feature.hosts

import com.nashaofu.shell360.core.data.HostModel

data class HostsUiState(
    val query: String = "",
    val selectedTag: String? = null,
    val editorHost: HostModel? = null,
    val isEditorOpen: Boolean = false,
    val deleteTarget: HostModel? = null,
    val feedbackMessage: String? = null,
)

fun filterHosts(hosts: List<HostModel>, query: String, selectedTag: String?): List<HostModel> {
    val keyword = query.trim().lowercase()
    return hosts.filter { host ->
        val matchesTag = selectedTag == null || host.tags.contains(selectedTag)
        if (!matchesTag) {
            return@filter false
        }
        if (keyword.isEmpty()) {
            return@filter true
        }
        host.name.lowercase().contains(keyword) ||
            host.username.lowercase().contains(keyword) ||
            host.tags.any { it.lowercase().contains(keyword) } ||
            "${host.hostname}:${host.port}".lowercase().contains(keyword)
    }
}

fun collectTags(hosts: List<HostModel>): List<String> =
    hosts.flatMap { it.tags }.distinct().sorted()
