package com.nashaofu.shell360.feature.hosts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Label
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.UploadFile
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import com.nashaofu.shell360.core.data.HostModel
import com.nashaofu.shell360.core.data.SessionKind
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.ui.components.AppAccentButton
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppPageContent
import com.nashaofu.shell360.ui.components.AppCard
import com.nashaofu.shell360.ui.components.AppErrorText
import com.nashaofu.shell360.ui.components.AppIconTile
import com.nashaofu.shell360.ui.components.AppOutlinedButton
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppSoftButton
import com.nashaofu.shell360.ui.components.AppStatusDot
import com.nashaofu.shell360.ui.components.AppTag
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.AppTopBar
import com.nashaofu.shell360.ui.components.EmptyState
import com.nashaofu.shell360.ui.components.FeedbackEffect
import com.nashaofu.shell360.ui.components.FilterButton
import com.nashaofu.shell360.ui.components.SearchToolbar
import com.nashaofu.shell360.ui.components.rememberFeedbackHost
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType
import com.nashaofu.shell360.ui.theme.AppSpacing

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun HostsScreen(
    viewModel: HostsViewModel = remember { HostsViewModel() },
    onOpenNavigation: () -> Unit = {},
    onOpenSession: (String) -> Unit = {},
    onAddHost: () -> Unit = {},
    onEditHost: (String) -> Unit = {},
) {
    val state = viewModel.uiState
    val hosts = Shell360Store.hosts
    val sessions = Shell360Store.sessions
    val snackbarHostState = rememberFeedbackHost()

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        viewModel.onAction(HostsAction.FeedbackDismissed)
    }

    val visibleHosts = filterHosts(hosts, state.query, state.selectedTag)
    val tags = collectTags(hosts)

    fun openSession(host: HostModel, kind: SessionKind) {
        val session = Shell360Store.openSession(host, kind)
        onOpenSession(session.id)
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Hosts",
                onOpenNavigation = onOpenNavigation,
                actions = {
                    IconButton(
                        onClick = onAddHost,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "New Host",
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
                placeholder = "Search hosts",
                onValueChange = { viewModel.onAction(HostsAction.QueryChanged(it)) },
                trailing = {
                    TagFilterButton(
                        selected = state.selectedTag,
                        tags = tags,
                        onSelect = { viewModel.onAction(HostsAction.TagSelected(it)) },
                    )
                },
            )
            Spacer(Modifier.height(AppSpacing.lg))

            when {
                hosts.isEmpty() -> EmptyState(
                    modifier = Modifier.weight(1f),
                    desc = "There is no host yet, add it now.",
                    action = {
                        AppButton(onClick = onAddHost) {
                            Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(AppSizes.buttonIcon))
                            Spacer(Modifier.width(AppSpacing.sm))
                            Text("New Host", style = AppType.buttonLabel)
                        }
                    },
                )

                visibleHosts.isEmpty() -> EmptyState(
                    modifier = Modifier.weight(1f),
                    title = "No hosts match your search.",
                    desc = "Try another search or clear your filters.",
                    icon = Icons.Filled.Dns,
                    action = {
                        AppSoftButton(onClick = { viewModel.onAction(HostsAction.ClearFiltersClicked) }) {
                            Text("Clear search", style = AppType.buttonLabel)
                        }
                    },
                )

                else -> LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
                    contentPadding = PaddingValues(bottom = AppSpacing.xl),
                ) {
                    items(visibleHosts, key = { it.id }) { host ->
                        HostCardItem(
                            host = host,
                            sessions = sessions,
                            onEdit = { onEditHost(host.id) },
                            onDuplicate = { viewModel.onAction(HostsAction.DuplicateClicked(host)) },
                            onDelete = { viewModel.onAction(HostsAction.DeleteClicked(host)) },
                            onOpen = { kind -> openSession(host, kind) },
                            onRetry = { kind ->
                                sessions
                                    .lastOrNull { it.hostId == host.id && it.kind == kind }
                                    ?.let { Shell360Store.closeSession(it.id) }
                                openSession(host, kind)
                            },
                        )
                    }
                }
            }
        }
    }

    state.deleteTarget?.let { host ->
        AppDialog(
            open = true,
            title = "Delete Confirmation",
            message = "Are you sure to delete the host: ${host.title}?",
            onDismiss = { viewModel.onAction(HostsAction.DeleteDismissed) },
            actions = {
                AppTextButton(
                    onClick = { viewModel.onAction(HostsAction.DeleteConfirmed) },
                    danger = true,
                ) { Text("Delete", style = AppType.buttonLabel) }
                AppTextButton(onClick = { viewModel.onAction(HostsAction.DeleteDismissed) }) {
                    Text("Cancel", style = AppType.buttonLabel)
                }
            },
        )
    }

}

@Composable
private fun TagFilterButton(
    selected: String?,
    tags: List<String>,
    onSelect: (String?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }

    Box {
        FilterButton(
            label = selected ?: "All",
            active = selected != null,
            onClick = { expanded = true },
            leadingIcon = Icons.AutoMirrored.Filled.Label,
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            FilterMenuItem("All", selected == null) {
                expanded = false
                onSelect(null)
            }
            tags.forEach { tag ->
                FilterMenuItem(tag, selected == tag) {
                    expanded = false
                    onSelect(tag)
                }
            }
        }
    }
}

@Composable
private fun FilterMenuItem(label: String, selected: Boolean, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(label, style = AppType.body, color = AppTheme.colors.textPrimary) },
        onClick = onClick,
        trailingIcon = if (selected) {
            {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = null,
                    tint = AppTheme.colors.accent,
                    modifier = Modifier.size(AppSizes.buttonIcon),
                )
            }
        } else {
            null
        },
    )
}

@Composable
private fun HostCardItem(
    host: HostModel,
    sessions: List<SessionModel>,
    onEdit: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
    onOpen: (SessionKind) -> Unit,
    onRetry: (SessionKind) -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    val colors = AppTheme.colors

    val sshSession = sessions.lastOrNull { it.hostId == host.id && it.kind == SessionKind.Terminal }
    val sftpSession = sessions.lastOrNull { it.hostId == host.id && it.kind == SessionKind.Sftp }
    val sshPending = sshSession?.status == SessionStatus.Pending
    val sftpPending = sftpSession?.status == SessionStatus.Pending
    val sshFailed = sshSession?.status == SessionStatus.Failed
    val sftpFailed = sftpSession?.status == SessionStatus.Failed

    val sshLabel = when {
        sshPending -> "Connecting…"
        sshFailed -> "Failed"
        else -> "SSH"
    }
    val sftpLabel = when {
        sftpPending -> "Connecting…"
        sftpFailed -> "Failed"
        else -> "SFTP"
    }
    val errorMessage = (sshSession?.takeIf { sshFailed }?.error ?: sftpSession?.takeIf { sftpFailed }?.error)
        ?: if (sshFailed || sftpFailed) "Connection failed" else null

    val dotColor = when {
        sshFailed || sftpFailed -> colors.statusError
        sshPending || sftpPending -> colors.statusWarning
        sshSession != null || sftpSession != null -> colors.accent
        else -> colors.statusOffline
    }

    AppCard() {
        Column(
            modifier = Modifier.padding(AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                AppIconTile {
                    Text(
                        text = host.title.take(1).uppercase(),
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
                            text = host.title,
                            style = AppType.cardTitle,
                            color = colors.textPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        AppStatusDot(color = dotColor)
                    }
                    Text(
                        text = host.description,
                        style = AppType.mono,
                        color = colors.textSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Box(Modifier.padding(top = AppSpacing.xs)) {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(
                            imageVector = Icons.Filled.MoreVert,
                            contentDescription = "More actions for ${host.title}",
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
                            text = { Text("Duplicate", style = AppType.body, color = colors.textPrimary) },
                            onClick = {
                                menuOpen = false
                                onDuplicate()
                            },
                            leadingIcon = { Icon(Icons.Filled.ContentCopy, contentDescription = null) },
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

            if (host.tags.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                    host.tags.forEach { tag -> AppTag(tag) }
                }
            }

            if (errorMessage != null) {
                AppErrorText(errorMessage)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                AppAccentButton(
                    onClick = {
                        if (sshFailed) onRetry(SessionKind.Terminal) else onOpen(SessionKind.Terminal)
                    },
                    enabled = !sshPending || sshFailed,
                    error = sshFailed,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Filled.Terminal, contentDescription = null, modifier = Modifier.size(AppSizes.buttonIcon))
                    Spacer(Modifier.width(AppSpacing.sm))
                    Text(sshLabel, style = AppType.buttonLabel)
                }
                AppOutlinedButton(
                    onClick = {
                        if (sftpFailed) onRetry(SessionKind.Sftp) else onOpen(SessionKind.Sftp)
                    },
                    enabled = !sftpPending || sftpFailed,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Filled.UploadFile, contentDescription = null, modifier = Modifier.size(AppSizes.buttonIcon))
                    Spacer(Modifier.width(AppSpacing.sm))
                    Text(sftpLabel, style = AppType.buttonLabel)
                }
            }
        }
    }
}
