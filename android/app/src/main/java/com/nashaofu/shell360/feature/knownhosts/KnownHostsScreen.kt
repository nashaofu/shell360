package com.nashaofu.shell360.feature.knownhosts

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Fingerprint
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import com.nashaofu.shell360.core.data.KnownHostModel
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.ui.components.AppCard
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppIconTile
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppSoftButton
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.AppTopBar
import com.nashaofu.shell360.ui.components.AppPageContent
import com.nashaofu.shell360.ui.components.EmptyState
import com.nashaofu.shell360.ui.components.FeedbackEffect
import com.nashaofu.shell360.ui.components.SearchToolbar
import com.nashaofu.shell360.ui.components.rememberFeedbackHost
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppType
import com.nashaofu.shell360.ui.theme.AppSpacing

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun KnownHostsScreen(
    viewModel: KnownHostsViewModel = remember { KnownHostsViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    val items = Shell360Store.knownHosts
    val snackbarHostState = rememberFeedbackHost()

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        viewModel.onAction(KnownHostsAction.FeedbackDismissed)
    }

    val visibleItems = filterKnownHosts(items, state.query)

    Scaffold(
        topBar = {
            AppTopBar(title = "Known Hosts", onOpenNavigation = onOpenNavigation)
        },
        snackbarHost = { AppSnackbarHost(snackbarHostState) },
        containerColor = AppTheme.colors.bgPage,
    ) { padding ->
        AppPageContent(modifier = Modifier.padding(padding)) {
            Spacer(Modifier.height(AppSpacing.sm))
            SearchToolbar(
                value = state.query,
                placeholder = "Search hostname or fingerprint",
                onValueChange = { viewModel.onAction(KnownHostsAction.QueryChanged(it)) },
            )
            Spacer(Modifier.height(AppSpacing.lg))

            when {
                visibleItems.isEmpty() -> EmptyState(
                    modifier = Modifier.weight(1f),
                    desc = if (items.isNotEmpty()) {
                        "No known hosts match your search."
                    } else {
                        "There is no known hosts yet."
                    },
                    icon = Icons.Filled.Fingerprint,
                    action = if (items.isNotEmpty()) {
                        {
                            AppSoftButton(
                                onClick = { viewModel.onAction(KnownHostsAction.ClearSearchClicked) },
                            ) { Text("Clear search", style = AppType.buttonLabel) }
                        }
                    } else {
                        null
                    },
                )

                else -> LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
                    contentPadding = PaddingValues(bottom = AppSpacing.xl),
                ) {
                    items(visibleItems, key = { it.id }) { item ->
                        KnownHostCardItem(
                            item = item,
                            onDelete = { viewModel.onAction(KnownHostsAction.DeleteClicked(item)) },
                        )
                    }
                }
            }
        }
    }

    state.deleteTarget?.let { item ->
        AppDialog(
            open = true,
            title = "Delete Confirmation",
            message = "Are you sure to delete the known host: ${item.rawLine}?",
            onDismiss = { viewModel.onAction(KnownHostsAction.DeleteDismissed) },
            actions = {
                AppTextButton(
                    onClick = { viewModel.onAction(KnownHostsAction.DeleteConfirmed) },
                    danger = true,
                ) { Text("Delete", style = AppType.buttonLabel) }
                AppTextButton(onClick = { viewModel.onAction(KnownHostsAction.DeleteDismissed) }) {
                    Text("Cancel", style = AppType.buttonLabel)
                }
            },
        )
    }
}

@Composable
private fun KnownHostCardItem(item: KnownHostModel, onDelete: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    val colors = AppTheme.colors

    AppCard() {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIconTile(
                containerColor = colors.bgSubtle,
                contentColor = colors.textSecondary,
            ) {
                Icon(
                    imageVector = Icons.Filled.Fingerprint,
                    contentDescription = null,
                    tint = colors.textSecondary,
                    modifier = Modifier.size(AppSizes.icon),
                )
            }

            Column(
                modifier = Modifier
                    .padding(horizontal = AppSpacing.md)
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(AppSpacing.xs),
            ) {
                Text(
                    text = item.host,
                    style = AppType.itemTitle,
                    color = colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = item.fingerprintPreview,
                    style = AppType.mono,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Box {
                IconButton(onClick = { menuOpen = true }) {
                    Icon(
                        imageVector = Icons.Filled.MoreVert,
                        contentDescription = "More actions for ${item.host}",
                        tint = colors.textSecondary,
                    )
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text("Delete", style = AppType.body, color = colors.errorText) },
                        onClick = {
                            menuOpen = false
                            onDelete()
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Filled.DeleteOutline,
                                contentDescription = null,
                                tint = colors.errorText,
                            )
                        },
                    )
                }
            }
        }
    }
}
