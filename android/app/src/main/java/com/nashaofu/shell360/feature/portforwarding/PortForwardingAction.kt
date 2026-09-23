package com.nashaofu.shell360.feature.portforwarding

sealed interface PortForwardingAction {
    data class QueryChanged(val value: String) : PortForwardingAction
    data object AddClicked : PortForwardingAction
    data class EditClicked(val item: PortForwardingItem) : PortForwardingAction
    data class DeleteClicked(val item: PortForwardingItem) : PortForwardingAction
    data object EditorDismissed : PortForwardingAction
    data class Saved(val item: PortForwardingItem) : PortForwardingAction
    data class RuntimeRequested(val item: PortForwardingItem) : PortForwardingAction
    data object FeedbackDismissed : PortForwardingAction
}
