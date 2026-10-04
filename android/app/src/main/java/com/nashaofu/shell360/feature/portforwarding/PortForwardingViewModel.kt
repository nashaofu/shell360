package com.nashaofu.shell360.feature.portforwarding

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import kotlinx.coroutines.launch

class PortForwardingViewModel {
    var uiState: PortForwardingUiState by mutableStateOf(PortForwardingUiState())
        private set

    fun onAction(action: PortForwardingAction) {
        uiState = when (action) {
            is PortForwardingAction.QueryChanged -> uiState.copy(query = action.value)
            PortForwardingAction.AddClicked -> uiState.copy(editorItem = null, isEditorOpen = true)
            is PortForwardingAction.EditClicked -> uiState.copy(editorItem = action.item, isEditorOpen = true)
            is PortForwardingAction.DeleteClicked -> uiState.copy(deleteTarget = action.item)
            PortForwardingAction.DeleteDismissed -> uiState.copy(deleteTarget = null)
            PortForwardingAction.DeleteConfirmed -> {
                val target = uiState.deleteTarget
                if (target != null) AndroidRuntime.scope.launch {
                    runCatching { AndroidRuntime.deleteTunnel(target) }
                        .onSuccess { Shell360Store.deleteTunnel(target.id) }
                        .onFailure { uiState = uiState.copy(feedbackMessage = it.message ?: "Could not delete tunnel") }
                }
                uiState.copy(deleteTarget = null)
            }

            PortForwardingAction.EditorDismissed -> uiState.copy(editorItem = null, isEditorOpen = false)
            is PortForwardingAction.RuntimeToggled -> {
                AndroidRuntime.scope.launch {
                    runCatching { AndroidRuntime.toggleTunnel(action.item) }
                        .onFailure {
                            if (it is com.nashaofu.shell360.core.runtime.NativeRuntimeException && it.code == "SSH_UNKNOWN_SERVER_KEY") {
                                Shell360Store.setTunnelError(action.item.id, it.message ?: "Unknown SSH host key")
                                uiState = uiState.copy(unknownKeyTunnel = action.item)
                            } else {
                                uiState = uiState.copy(feedbackMessage = it.message ?: "Could not change tunnel state")
                            }
                        }
                        .onSuccess {
                            val running = Shell360Store.isTunnelRunning(action.item.id)
                            uiState = uiState.copy(feedbackMessage = if (running) "Tunnel started" else "Tunnel stopped")
                        }
                }
                uiState
            }

            PortForwardingAction.ClearSearchClicked -> uiState.copy(query = "")
            is PortForwardingAction.UnknownKeyConfirmed -> {
                val tunnel = uiState.unknownKeyTunnel
                if (tunnel != null && action.trust) AndroidRuntime.retryTunnel(
                    tunnel,
                    tunnelAuthMethod(tunnel),
                    tunnelPassword(tunnel),
                    tunnelKeyId(tunnel),
                    true,
                )
                uiState.copy(unknownKeyTunnel = null)
            }
            PortForwardingAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }
}

private fun tunnelAuthMethod(tunnel: com.nashaofu.shell360.core.data.TunnelModel) =
    Shell360Store.hostById(tunnel.hostId)?.authenticationMethod ?: com.nashaofu.shell360.core.data.AuthMethod.Password

private fun tunnelPassword(tunnel: com.nashaofu.shell360.core.data.TunnelModel) =
    Shell360Store.hostById(tunnel.hostId)?.password.orEmpty()

private fun tunnelKeyId(tunnel: com.nashaofu.shell360.core.data.TunnelModel) =
    Shell360Store.hostById(tunnel.hostId)?.keyId.orEmpty()
