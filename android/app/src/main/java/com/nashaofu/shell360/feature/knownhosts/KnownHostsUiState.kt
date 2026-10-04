package com.nashaofu.shell360.feature.knownhosts

import com.nashaofu.shell360.core.data.KnownHostModel

data class KnownHostsUiState(
    val query: String = "",
    val deleteTarget: KnownHostModel? = null,
    val feedbackMessage: String? = null,
)

fun filterKnownHosts(items: List<KnownHostModel>, query: String): List<KnownHostModel> {
    val keyword = query.trim().lowercase()
    if (keyword.isEmpty()) return items
    return items.filter { item ->
        listOf(item.host, item.type, item.key, item.marker).any {
            it.lowercase().contains(keyword)
        }
    }
}
