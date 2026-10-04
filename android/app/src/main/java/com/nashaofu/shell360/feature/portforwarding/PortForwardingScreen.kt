package com.nashaofu.shell360.feature.portforwarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.core.data.TunnelModel
import com.nashaofu.shell360.core.data.TunnelType
import com.nashaofu.shell360.core.data.newId
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppCard
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppGroupLabel
import com.nashaofu.shell360.ui.components.AppIconTile
import com.nashaofu.shell360.ui.components.AppOutlinedButton
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppSoftButton
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.AppTopBar
import com.nashaofu.shell360.ui.components.AppPageContent
import com.nashaofu.shell360.ui.components.DrawerActions
import com.nashaofu.shell360.ui.components.EmptyState
import com.nashaofu.shell360.ui.components.FeedbackEffect
import com.nashaofu.shell360.ui.components.FormSelectField
import com.nashaofu.shell360.ui.components.FormTextField
import com.nashaofu.shell360.ui.components.PageDrawer
import com.nashaofu.shell360.ui.components.SearchToolbar
import com.nashaofu.shell360.ui.components.SelectOption
import com.nashaofu.shell360.ui.components.rememberFeedbackHost
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType
import com.nashaofu.shell360.ui.theme.AppSpacing
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PortForwardingScreen(
    viewModel: PortForwardingViewModel = remember { PortForwardingViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    val tunnels = Shell360Store.tunnels
    val running = Shell360Store.runningTunnels
    val snackbarHostState = rememberFeedbackHost()

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        viewModel.onAction(PortForwardingAction.FeedbackDismissed)
    }

    val visibleItems = filterTunnels(tunnels, state.query)
    val activeItems = visibleItems.filter { running.contains(it.id) }
    val inactiveItems = visibleItems.filterNot { running.contains(it.id) }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Tunnels",
                onOpenNavigation = onOpenNavigation,
                actions = {
                    IconButton(
                        onClick = { viewModel.onAction(PortForwardingAction.AddClicked) },
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "New Tunnel",
                            tint = AppTheme.colors.textPrimary,
                        )
                    }
                },
            )
        },
        snackbarHost = { AppSnackbarHost(snackbarHostState) },
        containerColor = AppTheme.colors.bgPage,
    ) { padding ->
        AppPageContent(modifier = Modifier.padding(padding)) {
            Spacer(Modifier.height(AppSpacing.sm))
            SearchToolbar(
                value = state.query,
                placeholder = "Search tunnels",
                onValueChange = { viewModel.onAction(PortForwardingAction.QueryChanged(it)) },
            )
            Spacer(Modifier.height(AppSpacing.lg))

            if (visibleItems.isEmpty()) {
                EmptyState(
                    modifier = Modifier.weight(1f),
                    desc = if (tunnels.isNotEmpty()) {
                        "No tunnels match your search."
                    } else {
                        "There is no tunnel yet, add it now."
                    },
                    icon = Icons.Filled.AccountTree,
                    action = if (tunnels.isNotEmpty()) {
                        {
                            AppSoftButton(
                                onClick = { viewModel.onAction(PortForwardingAction.ClearSearchClicked) },
                            ) { Text("Clear search", style = AppType.buttonLabel) }
                        }
                    } else {
                        {
                            AppButton(onClick = { viewModel.onAction(PortForwardingAction.AddClicked) }) {
                                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(AppSizes.buttonIcon))
                                Spacer(Modifier.width(AppSpacing.sm))
                                Text("New tunnel", style = AppType.buttonLabel)
                            }
                        }
                    },
                )
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
                    contentPadding = PaddingValues(bottom = AppSpacing.xl),
                ) {
                    if (activeItems.isNotEmpty()) {
                        item {
                            AppGroupLabel("Active", Modifier.padding(bottom = AppSpacing.xs))
                        }
                        items(activeItems, key = { it.id }) { item ->
                            TunnelCardItem(
                                item = item,
                                isRunning = true,
                                onEdit = { viewModel.onAction(PortForwardingAction.EditClicked(item)) },
                                onDelete = { viewModel.onAction(PortForwardingAction.DeleteClicked(item)) },
        onToggle = { viewModel.onAction(PortForwardingAction.RuntimeToggled(item)) },
                            )
                        }
                    }
                    if (inactiveItems.isNotEmpty()) {
                        item {
                            AppGroupLabel(
                                "Inactive",
                                Modifier.padding(top = if (activeItems.isEmpty()) 0.dp else AppSpacing.sm, bottom = AppSpacing.xs),
                            )
                        }
                        items(inactiveItems, key = { it.id }) { item ->
                            TunnelCardItem(
                                item = item,
                                isRunning = false,
                                onEdit = { viewModel.onAction(PortForwardingAction.EditClicked(item)) },
                                onDelete = { viewModel.onAction(PortForwardingAction.DeleteClicked(item)) },
                                onToggle = { viewModel.onAction(PortForwardingAction.RuntimeToggled(item)) },
                            )
                        }
                    }
                }
            }
        }
    }

    state.deleteTarget?.let { item ->
        AppDialog(
            open = true,
            title = "Delete Confirmation",
            message = "Are you sure to delete the tunnel: ${item.name}?",
            onDismiss = { viewModel.onAction(PortForwardingAction.DeleteDismissed) },
            actions = {
                AppTextButton(
                    onClick = { viewModel.onAction(PortForwardingAction.DeleteConfirmed) },
                    danger = true,
                ) { Text("Delete", style = AppType.buttonLabel) }
                AppTextButton(onClick = { viewModel.onAction(PortForwardingAction.DeleteDismissed) }) {
                    Text("Cancel", style = AppType.buttonLabel)
                }
            },
        )
    }

    state.unknownKeyTunnel?.let { tunnel ->
        AppDialog(
            open = true,
            title = "Trust SSH host key?",
            message = Shell360Store.tunnelErrors[tunnel.id].orEmpty(),
            onDismiss = { viewModel.onAction(PortForwardingAction.UnknownKeyConfirmed(false)) },
            actions = {
                AppTextButton(onClick = { viewModel.onAction(PortForwardingAction.UnknownKeyConfirmed(false)) }) { Text("Cancel") }
                AppTextButton(onClick = { viewModel.onAction(PortForwardingAction.UnknownKeyConfirmed(true)) }) { Text("Trust and connect") }
            },
        )
    }

    TunnelEditorDrawer(
        open = state.isEditorOpen,
        data = state.editorItem,
        onCancel = { viewModel.onAction(PortForwardingAction.EditorDismissed) },
        onSaved = { viewModel.onAction(PortForwardingAction.EditorDismissed) },
    )
}

@Composable
private fun TunnelCardItem(
    item: TunnelModel,
    isRunning: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggle: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    val colors = AppTheme.colors
    val hostName = Shell360Store.hostById(item.hostId)?.title ?: item.hostId

    AppCard() {
        Column(
            modifier = Modifier.padding(AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AppIconTile {
                    Text(
                        text = item.type.name.take(1),
                        style = AppType.cardTitle,
                        color = colors.accentText,
                    )
                }

                Column(
                    modifier = Modifier
                        .padding(start = AppSpacing.md)
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.xs),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                    ) {
                        Text(
                            text = item.name,
                            style = AppType.cardTitle,
                            color = colors.textPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        if (isRunning) {
                            Text(
                                text = "Active",
                                style = AppType.badge,
                                color = colors.accentText,
                            )
                        }
                    }
                    Text(
                        text = item.description(hostName),
                        style = AppType.caption,
                        color = colors.textSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(
                            imageVector = Icons.Filled.MoreVert,
                            contentDescription = "More actions for ${item.name}",
                            tint = colors.textSecondary,
                        )
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Edit", style = AppType.body, color = colors.textPrimary) },
                            onClick = {
                                menuOpen = false
                                onEdit()
                            },
                            leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null) },
                        )
                        DropdownMenuItem(
                            text = { Text("Delete", style = AppType.body, color = colors.errorText) },
                            onClick = {
                                menuOpen = false
                                onDelete()
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Filled.DeleteOutline,
                                    contentDescription = null,
                                    tint = colors.errorText,
                                )
                            },
                        )
                    }
                }
            }

            if (isRunning) {
                AppOutlinedButton(onClick = onToggle, modifier = Modifier.fillMaxWidth()) {
                    Text("Stop", style = AppType.buttonLabel)
                }
            } else {
                AppButton(onClick = onToggle, modifier = Modifier.fillMaxWidth()) {
                    Text("Start", style = AppType.buttonLabel)
                }
            }
        }
    }
}

private data class TunnelDraft(
    val id: String,
    val name: String,
    val type: TunnelType,
    val hostId: String,
    val localAddress: String,
    val localPortText: String,
    val remoteAddress: String,
    val remotePortText: String,
) {
    companion object {
        fun from(item: TunnelModel?): TunnelDraft = TunnelDraft(
            id = item?.id ?: newId(),
            name = item?.name.orEmpty(),
            type = item?.type ?: TunnelType.Local,
            hostId = item?.hostId.orEmpty(),
            localAddress = item?.localAddress ?: "127.0.0.1",
            localPortText = item?.localPort?.takeIf { it > 0 }?.toString().orEmpty(),
            remoteAddress = item?.remoteAddress.orEmpty(),
            remotePortText = item?.remotePort?.toString().orEmpty(),
        )
    }

    fun toModel(): TunnelModel = TunnelModel(
        id = id,
        name = name.trim(),
        type = type,
        hostId = hostId,
        localAddress = localAddress.trim(),
        localPort = localPortText.toIntOrNull() ?: 0,
        remoteAddress = remoteAddress.trim(),
        remotePort = remotePortText.toIntOrNull(),
    )
}

@Composable
private fun TunnelEditorDrawer(
    open: Boolean,
    data: TunnelModel?,
    onCancel: () -> Unit,
    onSaved: (TunnelModel) -> Unit,
) {
    var draft by remember(open, data) { mutableStateOf(TunnelDraft.from(data)) }
    var submitted by remember(open, data) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val hosts = Shell360Store.hosts
    val isDynamic = draft.type == TunnelType.Dynamic
    val localPort = draft.localPortText.toIntOrNull()
    val remotePort = draft.remotePortText.toIntOrNull()

    val nameError = when {
        !submitted -> null
        draft.name.isBlank() -> "Please enter name"
        draft.name.length > 60 -> "Please enter no more than 60 characters"
        else -> null
    }
    val hostError = if (submitted && draft.hostId.isBlank()) "Please select host" else null
    val localAddressError = when {
        !submitted -> null
        draft.localAddress.isBlank() -> "Please enter local address"
        draft.localAddress.length < 3 -> "Please enter at least 3 characters"
        draft.localAddress.length > 60 -> "Please enter no more than 60 characters"
        else -> null
    }
    val localPortError = when {
        !submitted -> null
        localPort == null -> "Please enter local port"
        localPort < 1 -> "The local port cannot be less than 1"
        localPort > 65535 -> "The local port cannot be greater than 65535"
        else -> null
    }
    val remoteAddressError = when {
        !submitted || isDynamic -> null
        draft.remoteAddress.isBlank() -> "Please enter remote address"
        draft.remoteAddress.length < 3 -> "Please enter at least 3 characters"
        draft.remoteAddress.length > 60 -> "Please enter no more than 60 characters"
        else -> null
    }
    val remotePortError = when {
        !submitted || isDynamic -> null
        remotePort == null -> "Please enter remote port"
        remotePort < 1 -> "The remote port cannot be less than 1"
        remotePort > 65535 -> "The remote port cannot be greater than 65535"
        else -> null
    }

    val hasError = listOf(
        nameError,
        hostError,
        localAddressError,
        localPortError,
        remoteAddressError,
        remotePortError,
    ).any { it != null }

    PageDrawer(
        open = open,
        title = if (data == null) "Add tunnel" else "Edit tunnel",
        onCancel = onCancel,
        footer = {
            DrawerActions {
                AppOutlinedButton(onClick = onCancel) { Text("Cancel", style = AppType.buttonLabel) }
                AppButton(
                    onClick = {
                        submitted = true
                        if (!hasError) {
                            val model = draft.toModel()
                            scope.launch {
                                runCatching { AndroidRuntime.saveTunnel(model) }
                                    .onSuccess { saved ->
                                        Shell360Store.saveTunnel(saved)
                                        onSaved(saved)
                                    }
                                    .onFailure { Toast.makeText(context, it.message ?: "Could not save tunnel", Toast.LENGTH_LONG).show() }
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("Save", style = AppType.buttonLabel) }
            }
        },
    ) {
        FormTextField(
            label = "Name",
            value = draft.name,
            onValueChange = { draft = draft.copy(name = it) },
            placeholder = "Name",
            error = nameError,
        )

        FormSelectField(
            label = "Tunnel type",
            value = draft.type.name,
            options = TunnelType.entries.map { SelectOption(it.name, it.label) },
            onValueChange = { value -> draft = draft.copy(type = TunnelType.valueOf(value)) },
        )

        FormSelectField(
            label = "Host",
            value = draft.hostId,
            options = hosts.map { SelectOption(it.id, it.title) },
            onValueChange = { draft = draft.copy(hostId = it) },
            placeholder = "Select host",
            error = hostError,
        )

        FormTextField(
            label = "Local address",
            value = draft.localAddress,
            onValueChange = { draft = draft.copy(localAddress = it) },
            placeholder = "Local address",
            error = localAddressError,
        )

        FormTextField(
            label = "Local port",
            value = draft.localPortText,
            onValueChange = { value -> draft = draft.copy(localPortText = value.filter { it.isDigit() }) },
            placeholder = "Local port",
            error = localPortError,
            keyboardType = KeyboardType.Number,
        )

        if (!isDynamic) {
            FormTextField(
                label = "Remote address",
                value = draft.remoteAddress,
                onValueChange = { draft = draft.copy(remoteAddress = it) },
                placeholder = "Remote address",
                error = remoteAddressError,
            )
            FormTextField(
                label = "Remote port",
                value = draft.remotePortText,
                onValueChange = { value -> draft = draft.copy(remotePortText = value.filter { it.isDigit() }) },
                placeholder = "Remote port",
                error = remotePortError,
                keyboardType = KeyboardType.Number,
            )
        }
    }
}
