package com.nashaofu.shell360.feature.keys

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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
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
import com.nashaofu.shell360.core.data.KeyModel
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppPageContent
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppCard
import com.nashaofu.shell360.ui.components.AppIconTile
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppSoftButton
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
fun KeysScreen(
    viewModel: KeysViewModel = remember { KeysViewModel() },
    onOpenNavigation: () -> Unit = {},
    onAddKey: () -> Unit = {},
    onEditKey: (String) -> Unit = {},
) {
    val state = viewModel.uiState
    val keys = Shell360Store.keys
    val snackbarHostState = rememberFeedbackHost()
    var addMenuOpen by remember { mutableStateOf(false) }

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        viewModel.onAction(KeysAction.FeedbackDismissed)
    }

    val visibleKeys = filterKeys(keys, state.query, state.selectedType)

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Keys",
                onOpenNavigation = onOpenNavigation,
                actions = {
                    Box {
                        IconButton(onClick = { addMenuOpen = true }) {
                            Icon(
                                imageVector = Icons.Filled.Add,
                                contentDescription = "Generate or import key",
                                tint = AppTheme.colors.textPrimary,
                            )
                        }
                        DropdownMenu(expanded = addMenuOpen, onDismissRequest = { addMenuOpen = false }) {
                            DropdownMenuItem(
                                text = { MenuText("Generate key") },
                                onClick = {
                                    addMenuOpen = false
                                    onAddKey()
                                },
                            )
                            DropdownMenuItem(
                                text = { MenuText("Import key") },
                                onClick = {
                                    addMenuOpen = false
                                    onAddKey()
                                },
                            )
                        }
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
                placeholder = "Search keys",
                onValueChange = { viewModel.onAction(KeysAction.QueryChanged(it)) },
                trailing = {
                    TypeFilterButton(
                        selected = state.selectedType,
                        onSelect = { viewModel.onAction(KeysAction.TypeSelected(it)) },
                    )
                },
            )
            Spacer(Modifier.height(AppSpacing.lg))

            when {
                keys.isEmpty() -> EmptyState(
                    modifier = Modifier.weight(1f),
                    desc = "There is no key yet, add it now.",
                    action = {
                        AppButton(onClick = onAddKey) {
                            Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(AppSizes.buttonIcon))
                            Spacer(Modifier.width(AppSpacing.sm))
                            Text("New key", style = AppType.buttonLabel)
                        }
                    },
                )

                visibleKeys.isEmpty() -> EmptyState(
                    modifier = Modifier.weight(1f),
                    title = "No keys match your search.",
                    icon = Icons.Filled.Key,
                    action = {
                        AppSoftButton(onClick = { viewModel.onAction(KeysAction.ClearFiltersClicked) }) {
                            Text("Clear search", style = AppType.buttonLabel)
                        }
                    },
                )

                else -> LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
                    contentPadding = PaddingValues(bottom = AppSpacing.xl),
                ) {
                    items(visibleKeys, key = { it.id }) { key ->
                        KeyCardItem(
                            key = key,
                            onEdit = { onEditKey(key.id) },
                            onDuplicate = { viewModel.onAction(KeysAction.DuplicateClicked(key)) },
                            onDelete = { viewModel.onAction(KeysAction.DeleteClicked(key)) },
                        )
                    }
                }
            }
        }
    }

    state.deleteTarget?.let { key ->
        AppDialog(
            open = true,
            title = "Delete Confirmation",
            message = "Are you sure to delete the key: ${key.name}?",
            onDismiss = { viewModel.onAction(KeysAction.DeleteDismissed) },
            actions = {
                AppTextButton(
                    onClick = { viewModel.onAction(KeysAction.DeleteConfirmed) },
                    danger = true,
                ) { Text("Delete", style = AppType.buttonLabel) }
                AppTextButton(onClick = { viewModel.onAction(KeysAction.DeleteDismissed) }) {
                    Text("Cancel", style = AppType.buttonLabel)
                }
            },
        )
    }

}

@Composable
private fun MenuText(text: String) {
    Text(text = text, style = AppType.body, color = AppTheme.colors.textPrimary)
}

@Composable
private fun TypeFilterButton(selected: String?, onSelect: (String?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }

    Box {
        FilterButton(
            label = selected ?: "All types",
            active = selected != null,
            onClick = { expanded = true },
            leadingIcon = Icons.Filled.Key,
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            TypeMenuItem("All types", selected == null) {
                expanded = false
                onSelect(null)
            }
            KEY_TYPE_OPTIONS.forEach { type ->
                TypeMenuItem(type, selected == type) {
                    expanded = false
                    onSelect(type)
                }
            }
        }
    }
}

@Composable
private fun TypeMenuItem(label: String, selected: Boolean, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { MenuText(label) },
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
private fun KeyCardItem(
    key: KeyModel,
    onEdit: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    val colors = AppTheme.colors

    AppCard() {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIconTile {
                Text(
                    text = key.name.take(1).uppercase().ifEmpty { "K" },
                    style = AppType.cardTitle,
                    color = colors.accentText,
                )
            }

            Column(
                modifier = Modifier
                    .padding(horizontal = AppSpacing.md)
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(AppSpacing.xs),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                ) {
                    Text(
                        text = key.name,
                        style = AppType.itemTitle,
                        color = colors.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (key.passphrase.isNotEmpty()) {
                        Icon(
                            imageVector = Icons.Filled.Lock,
                            contentDescription = "Passphrase protected",
                            tint = colors.textMuted,
                            modifier = Modifier.size(AppSizes.tableIcon),
                        )
                    }
                    if (key.certificate.isNotEmpty()) {
                        AppTag("Signed certificate", accent = true)
                    }
                }
                Text(
                    text = "SHA256:${key.preview}",
                    style = AppType.mono,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            AppTag(key.typeLabel)

            Box(Modifier.padding(start = AppSpacing.xs)) {
                IconButton(onClick = { menuOpen = true }) {
                    Icon(
                        imageVector = Icons.Filled.MoreVert,
                        contentDescription = "More actions for ${key.name}",
                        tint = colors.textSecondary,
                    )
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { MenuText("Edit") },
                        onClick = {
                            menuOpen = false
                            onEdit()
                        },
                        leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null) },
                    )
                    DropdownMenuItem(
                        text = { MenuText("Duplicate") },
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
                        leadingIcon = { Icon(Icons.Filled.DeleteOutline, contentDescription = null, tint = colors.errorText) },
                    )
                }
            }
        }
    }
}
