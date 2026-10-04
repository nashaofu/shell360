package com.nashaofu.shell360.app.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.core.data.SessionStatus
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppSizes

/**
 * Webview-sidebar equivalent: a persistent panel on wide screens that collapses to an
 * icon rail, and the modal drawer body on phones.
 *
 * On tablets the panel sits outside any Scaffold, so it has to apply the safe area
 * itself. Inside the modal drawer the sheet already consumes those insets.
 */
@Composable
fun SidebarPanel(
    expanded: Boolean,
    currentRoute: String,
    onNavigate: (TopLevelDestination) -> Unit,
    modifier: Modifier = Modifier,
    applySafeAreaInset: Boolean = false,
) {
    val safeArea = if (applySafeAreaInset) {
        WindowInsets.systemBars
            .union(WindowInsets.displayCutout)
            .only(WindowInsetsSides.Start + WindowInsetsSides.Top + WindowInsetsSides.Bottom)
    } else {
        WindowInsets(0, 0, 0, 0)
    }

    Column(
        modifier = modifier
            .width(if (expanded) AppSizes.sidebarExpandedWidth else AppSizes.sidebarCollapsedWidth)
            .fillMaxHeight()
            .background(AppTheme.colors.bgFrame)
            .windowInsetsPadding(safeArea)
            .padding(top = AppSpacing.lg),
    ) {
        BrandHeader(expanded)

        Spacer(Modifier.height(AppSpacing.xl))

        GroupLabel("Workspace", expanded)
        SidebarItem(
            icon = TopLevelDestination.Workspace.icon(),
            label = TopLevelDestination.Workspace.title,
            selected = currentRoute == TopLevelDestination.Workspace.route,
            expanded = expanded,
            badge = Shell360Store.sessions.count { it.status != SessionStatus.Failed },
            onClick = { onNavigate(TopLevelDestination.Workspace) },
        )

        HorizontalDivider(
            modifier = Modifier.padding(
                horizontal = if (expanded) AppSpacing.lg else AppSpacing.md,
                vertical = AppSpacing.md,
            ),
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            GroupLabel("Manage", expanded)
            TopLevelDestination.entries
                .filter { it != TopLevelDestination.Workspace && it != TopLevelDestination.Settings }
                .forEach { destination ->
                    SidebarItem(
                        icon = destination.icon(),
                        label = destination.title,
                        selected = currentRoute == destination.route,
                        expanded = expanded,
                        badge = null,
                        onClick = { onNavigate(destination) },
                    )
                }
        }

        HorizontalDivider(
            modifier = Modifier.padding(
                start = if (expanded) AppSpacing.lg else AppSpacing.md,
                end = if (expanded) AppSpacing.lg else AppSpacing.md,
                top = AppSpacing.xs,
            ),
        )
        SidebarItem(
            icon = TopLevelDestination.Settings.icon(),
            label = TopLevelDestination.Settings.title,
            selected = currentRoute == TopLevelDestination.Settings.route,
            expanded = expanded,
            badge = null,
            onClick = { onNavigate(TopLevelDestination.Settings) },
        )
    }
}

@Composable
private fun BrandHeader(expanded: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = if (expanded) AppSpacing.lg else 0.dp),
        horizontalArrangement = if (expanded) Arrangement.Start else Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            modifier = Modifier.size(AppSizes.smallTile),
            shape = MaterialTheme.shapes.small,
            color = AppTheme.colors.accent,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Filled.Terminal,
                    contentDescription = null,
                    tint = AppTheme.colors.onAccent,
                    modifier = Modifier.size(AppSizes.buttonIcon),
                )
            }
        }
        if (expanded) {
            Column(Modifier.padding(start = AppSpacing.md)) {
                Text(
                    text = "Shell360",
                    style = AppType.brand,
                    color = AppTheme.colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "SSH & SFTP client",
                    style = AppType.headerSubtitle,
                    color = AppTheme.colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun GroupLabel(label: String, expanded: Boolean) {
    if (!expanded) {
        Spacer(Modifier.height(AppSpacing.xl))
        return
    }
    Text(
        text = label.uppercase(),
        style = AppType.groupLabel,
        color = AppTheme.colors.textMuted,
        modifier = Modifier.padding(start = AppSpacing.xl, bottom = AppSpacing.sm),
    )
}

@Composable
private fun SidebarItem(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    expanded: Boolean,
    badge: Int?,
    onClick: () -> Unit,
) {
    val shape = MaterialTheme.shapes.medium

    Row(
        modifier = Modifier
            .padding(horizontal = AppSpacing.sm, vertical = AppSpacing.xs)
            .fillMaxWidth()
            .clip(shape)
            .background(if (selected) AppTheme.colors.accentSoft else Color.Transparent)
            .then(
                if (selected) {
                    Modifier.border(1.dp, AppTheme.colors.accentBorder, shape)
                } else {
                    Modifier
                },
            )
            .clickable { onClick() },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(AppSizes.sidebarItem)
                .padding(horizontal = if (expanded) AppSpacing.lg else 0.dp),
            horizontalArrangement = if (expanded) Arrangement.Start else Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (selected) AppTheme.colors.accent else AppTheme.colors.textSecondary,
            )
            if (expanded) {
                Text(
                    text = label,
                    style = AppType.bodyStrong,
                    color = if (selected) AppTheme.colors.accentText else AppTheme.colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .padding(start = AppSpacing.md)
                        .weight(1f),
                )
                if (badge != null && badge > 0) {
                    Box(
                        modifier = Modifier
                            .clip(MaterialTheme.shapes.extraSmall)
                            .background(AppTheme.colors.accent)
                            .border(2.dp, AppTheme.colors.bgFrame, MaterialTheme.shapes.extraSmall)
                            .padding(horizontal = AppSpacing.sm, vertical = 1.dp),
                    ) {
                        Text(
                            text = badge.toString(),
                            style = AppType.badge,
                            color = AppTheme.colors.bgFrame,
                        )
                    }
                }
            }
        }
    }
}
