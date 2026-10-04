package com.nashaofu.shell360.feature.portforwarding

import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.data.TunnelModel

data class PortForwardingUiState(
    val query: String = "",
    val editorItem: TunnelModel? = null,
    val isEditorOpen: Boolean = false,
    val deleteTarget: TunnelModel? = null,
    val feedbackMessage: String? = null,
    val unknownKeyTunnel: TunnelModel? = null,
)

fun filterTunnels(items: List<TunnelModel>, query: String): List<TunnelModel> {
    val keyword = query.trim().lowercase()
    if (keyword.isEmpty()) return items
    return items.filter { item ->
        val host = Shell360Store.hostById(item.hostId)
        listOf(
            item.name,
            item.type.label,
            "${item.localAddress}:${item.localPort}",
            "${item.remoteAddress}:${item.remotePort ?: ""}",
            host?.title.orEmpty(),
            host?.hostname.orEmpty(),
        ).any { it.lowercase().contains(keyword) }
    }
}
