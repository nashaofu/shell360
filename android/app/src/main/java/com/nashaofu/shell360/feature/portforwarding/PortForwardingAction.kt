package com.nashaofu.shell360.feature.portforwarding

import com.nashaofu.shell360.core.data.TunnelModel

sealed interface PortForwardingAction {
    data class QueryChanged(val value: String) : PortForwardingAction
    data object AddClicked : PortForwardingAction
    data class EditClicked(val item: TunnelModel) : PortForwardingAction
    data class DeleteClicked(val item: TunnelModel) : PortForwardingAction
    data object DeleteDismissed : PortForwardingAction
    data object DeleteConfirmed : PortForwardingAction
    data object EditorDismissed : PortForwardingAction
    data class RuntimeToggled(val item: TunnelModel) : PortForwardingAction
    data class UnknownKeyConfirmed(val trust: Boolean) : PortForwardingAction
    data object ClearSearchClicked : PortForwardingAction
    data object FeedbackDismissed : PortForwardingAction
}
