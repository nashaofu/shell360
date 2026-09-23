package com.nashaofu.shell360.feature.portforwarding

enum class PortForwardingType(val label: String) {
    Local("Local tunnel"),
    Remote("Remote tunnel"),
    Dynamic("Dynamic tunnel"),
}

data class PortForwardingItem(
    val id: String,
    val name: String,
    val type: PortForwardingType,
    val hostId: String,
    val localAddress: String,
    val localPort: Int,
    val remoteAddress: String = "",
    val remotePort: Int? = null,
)

data class PortForwardingUiState(
    val items: List<PortForwardingItem> = emptyList(),
    val isLoading: Boolean = false,
    val query: String = "",
    val editorItem: PortForwardingItem? = null,
    val isEditorOpen: Boolean = false,
    val pendingDelete: PortForwardingItem? = null,
    val feedbackMessage: String? = null,
)
