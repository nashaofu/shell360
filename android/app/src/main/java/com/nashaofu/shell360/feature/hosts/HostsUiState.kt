package com.nashaofu.shell360.feature.hosts

data class HostsUiState(
    val hosts: List<HostItem> = emptyList(),
    val query: String = "",
    val selectedTag: String? = null,
    val editorHost: HostItem? = null,
    val deleteTarget: HostItem? = null,
    val isEditorOpen: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val feedbackMessage: String? = null,
)
