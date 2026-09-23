package com.nashaofu.shell360.feature.knownhosts

data class KnownHostItem(
    val id: String,
    val host: String,
    val type: String,
    val fingerprint: String,
    val marker: String? = null,
)

data class KnownHostsUiState(
    val items: List<KnownHostItem> = emptyList(),
    val isLoading: Boolean = false,
    val query: String = "",
    val pendingDelete: KnownHostItem? = null,
    val feedbackMessage: String? = null,
)
