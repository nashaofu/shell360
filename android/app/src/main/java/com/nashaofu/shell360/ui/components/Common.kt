package com.nashaofu.shell360.ui.components

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType
import com.nashaofu.shell360.ui.theme.AppSizes

@Composable
fun rememberFeedbackHost(): SnackbarHostState = remember { SnackbarHostState() }

/**
 * Shows a message once and clears it, so a toast behaves like a native snackbar
 * rather than lingering in the Scaffold slot.
 */
@Composable
fun FeedbackEffect(
    message: String?,
    hostState: SnackbarHostState,
    onShown: () -> Unit,
) {
    LaunchedEffect(message, hostState) {
        if (message.isNullOrEmpty()) return@LaunchedEffect
        hostState.showSnackbar(message)
        onShown()
    }
}

@Composable
fun AppSnackbarHost(hostState: SnackbarHostState) {
    SnackbarHost(hostState = hostState)
}

@Composable
fun EmptyState(
    modifier: Modifier = Modifier,
    title: String? = null,
    desc: String? = null,
    icon: ImageVector? = null,
    action: @Composable (() -> Unit)? = null,
    secondaryAction: @Composable (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xl)
            .offset { IntOffset(0, -32) },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            modifier = Modifier.size(AppSizes.emptyCircle),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon ?: Icons.Filled.Inbox,
                    contentDescription = null,
                    modifier = Modifier.size(AppSizes.emptyIcon),
                )
            }
        }
        if (title != null) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = AppSpacing.lg),
            )
        }
        if (desc != null) {
            Text(
                text = desc,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = if (title != null) AppSpacing.sm else AppSpacing.lg),
            )
        }
        if (action != null || secondaryAction != null) {
            Row(
                modifier = Modifier.padding(top = AppSpacing.xl),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                action?.invoke()
                secondaryAction?.invoke()
            }
        }
    }
}

/** Search uses the same field height, shape, typography and focus treatment as forms. */
@Composable
fun SearchToolbar(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
    ) {
        AppFieldContainer(
            modifier = Modifier.weight(1f),
            focused = focused,
        ) {
            Icon(
                imageVector = Icons.Filled.Search,
                contentDescription = null,
                tint = colors.onSurfaceVariant,
                modifier = Modifier.size(AppSizes.inlineIcon),
            )
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = AppType.body.copy(color = colors.onSurface),
                cursorBrush = SolidColor(colors.primary),
                interactionSource = interaction,
                modifier = Modifier.weight(1f),
                decorationBox = { innerTextField ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = AppType.body,
                                color = colors.onSurfaceVariant,
                                maxLines = 1,
                            )
                        }
                        innerTextField()
                    }
                },
            )
            if (value.isNotEmpty()) {
                IconButton(onClick = { onValueChange("") }) {
                    Icon(
                        imageVector = Icons.Filled.Close,
                        contentDescription = "Clear search",
                        tint = colors.onSurfaceVariant,
                    )
                }
            }
        }
        trailing?.invoke()
    }
}

/** Material 3 filter chip used as the toolbar filter slot. */
@Composable
fun FilterButton(
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
) {
    FilterChip(
        selected = active,
        onClick = onClick,
        label = { Text(label, style = AppType.buttonLabel) },
        modifier = modifier.heightIn(min = AppSizes.chipHeight),
        leadingIcon = leadingIcon?.let { icon ->
            {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(FilterChipDefaults.IconSize),
                )
            }
        },
        colors = FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
            labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
        ),
    )
}

/** Material 3 modal bottom sheet with an optional footer action row. */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PageDrawer(
    open: Boolean,
    title: String,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    footer: @Composable (() -> Unit)? = null,
    fullscreen: Boolean = false,
    content: @Composable () -> Unit,
) {
    if (!open) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    if (fullscreen) {
        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars.only(WindowInsetsSides.Top + WindowInsetsSides.Bottom))
                .imePadding(),
        ) {
            EditorHeader(title, onCancel, loading)
            EditorBody(footer, content)
        }
        return
    }

    ModalBottomSheet(
        onDismissRequest = { if (!loading) onCancel() },
        sheetState = sheetState,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding(),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = AppSpacing.xl, end = AppSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f),
                )
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier
                            .padding(AppSpacing.md)
                            .size(AppSizes.buttonIcon),
                        strokeWidth = 2.dp,
                    )
                } else {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.Filled.Close, contentDescription = "Close")
                    }
                }
            }

            HorizontalDivider()

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = AppSizes.sessionSheetMaxHeight)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.lg),
                verticalArrangement = Arrangement.spacedBy(AppSpacing.lg),
            ) {
                content()
            }

            if (footer != null) {
                HorizontalDivider()
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
                ) {
                    footer()
                }
            }
        }
    }
}

@Composable
fun AppDialog(
    open: Boolean,
    title: String,
    message: String? = null,
    content: @Composable (() -> Unit)? = null,
    onDismiss: () -> Unit,
    actions: @Composable RowScope.() -> Unit,
) {
    if (!open) return
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.extraLarge)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.extraLarge)
                .padding(AppSpacing.xl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            Text(title, style = AppType.cardTitle, color = AppTheme.colors.textPrimary)
            if (message != null) Text(message, style = AppType.body, color = AppTheme.colors.textSecondary)
            content?.invoke()
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm, Alignment.End),
                content = actions,
            )
        }
    }
}

@Composable
private fun EditorHeader(title: String, onCancel: () -> Unit, loading: Boolean) {
    Row(Modifier.fillMaxWidth().padding(start = AppSpacing.xl, end = AppSpacing.sm), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        if (loading) CircularProgressIndicator(Modifier.padding(AppSpacing.md).size(AppSizes.buttonIcon), strokeWidth = 2.dp)
        else IconButton(onClick = onCancel) { Icon(Icons.Filled.Close, contentDescription = "Close") }
    }
    HorizontalDivider()
}

@Composable
private fun EditorBody(footer: @Composable (() -> Unit)?, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.lg),
        ) {
            content()
        }
        if (footer != null) {
            HorizontalDivider()
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(AppTheme.colors.bgPage)
                    .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
            ) {
                footer()
            }
        }
    }
}

@Composable
fun DrawerActions(content: @Composable RowScope.() -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        content()
    }
}

@Composable
fun AppHorizontalSpacer(width: androidx.compose.ui.unit.Dp = AppSpacing.sm) {
    Spacer(Modifier.width(width))
}
