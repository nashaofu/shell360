package com.nashaofu.shell360.feature.terminal

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppOutlinedButton

private const val PANEL_MAX_WIDTH = 480
private const val PANEL_MIN_HEIGHT = 260
private const val SPLIT_MIN_WIDTH = 150
private const val ICON_TINT_ALPHA = 0.12f
private const val ERROR_BORDER_ALPHA = 0.28f
private const val ERROR_FILL_ALPHA = 0.44f
private const val SPLIT_DIVIDER_ALPHA = 0.24f

/**
 * The connecting / failed mask from `SSHLoading`: an opaque full-area panel (no scrim),
 * a 42dp host tile, the `ssh …` command, a 6dp progress bar, and — only when failed —
 * the red message box plus the state's actions. [formContent] hosts the authentication
 * form for the two kinds that need user input.
 */
@Composable
fun SshLoadingMask(
    hostTitle: String,
    command: String,
    error: TerminalErrorPresentation?,
    onClose: () -> Unit,
    onPrimaryAction: () -> Unit,
    onPrimaryMenuAction: () -> Unit,
    modifier: Modifier = Modifier,
    formContent: (@Composable () -> Unit)? = null,
) {
    val colors = AppTheme.colors

    Box(
        modifier = modifier
            .background(colors.bgSurface)
            .padding(AppSpacing.lg),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = PANEL_MAX_WIDTH.dp)
                .heightIn(min = PANEL_MIN_HEIGHT.dp),
        ) {
            Row(
                modifier = Modifier.padding(AppSpacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    modifier = Modifier.size(AppSizes.maskIcon),
                    shape = MaterialTheme.shapes.small,
                    color = colors.accent.copy(alpha = ICON_TINT_ALPHA),
                    contentColor = colors.accentText,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Filled.Dns,
                            contentDescription = null,
                            modifier = Modifier.size(AppSizes.maskIconInner),
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .padding(start = AppSpacing.md)
                        .weight(1f),
                ) {
                    Text(
                        text = hostTitle,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = command,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Box(Modifier.padding(horizontal = AppSpacing.md)) {
                val bar = Modifier
                    .fillMaxWidth()
                    .height(AppSizes.progressThickness)
                    .clip(CircleShape)

                if (error == null) {
                    LinearProgressIndicator(modifier = bar)
                } else {
                    LinearProgressIndicator(
                        progress = { 1f },
                        modifier = bar,
                        color = colors.statusError,
                        trackColor = colors.borderSubtle,
                    )
                }
            }

            if (error != null) {
                Column(Modifier.padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm)) {
                    Text(
                        text = error.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.textPrimary,
                    )
                    Spacer(Modifier.height(AppSpacing.sm))

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.small,
                        color = colors.errorSoft.copy(alpha = ERROR_FILL_ALPHA),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 1.dp,
                            color = colors.statusError.copy(alpha = ERROR_BORDER_ALPHA),
                        ),
                    ) {
                        Text(
                            text = error.message,
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.statusError,
                            modifier = Modifier.padding(
                                horizontal = AppSpacing.md,
                                vertical = AppSpacing.sm,
                            ),
                        )
                    }

                    Spacer(Modifier.height(AppSpacing.md))

                    if (formContent != null) {
                        formContent()
                        Spacer(Modifier.height(AppSpacing.md))
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StatusOutlineButton("Close", onClose)

                        val label = error.primaryLabel
                        if (label != null) {
                            if (error.primaryMenuLabel != null) {
                                SplitPrimaryButton(
                                    label = label,
                                    menuLabel = error.primaryMenuLabel,
                                    onClick = onPrimaryAction,
                                    onMenuClick = onPrimaryMenuAction,
                                )
                            } else {
                                StatusPrimaryButton(label, onPrimaryAction)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun StatusOutlineButton(label: String, onClick: () -> Unit) {
    AppOutlinedButton(
        onClick = onClick,
        modifier = Modifier.widthIn(min = AppSizes.swipeAction),
    ) {
        Text(label)
    }
}

@Composable
internal fun StatusPrimaryButton(label: String, onClick: () -> Unit) {
    AppButton(
        onClick = onClick,
        modifier = Modifier.widthIn(min = AppSizes.swipeAction),
    ) {
        Text(label)
    }
}

/** Mirrors `.splitButtonGroup`: a filled main action plus a 32dp overflow menu. */
@Composable
private fun SplitPrimaryButton(
    label: String,
    menuLabel: String,
    onClick: () -> Unit,
    onMenuClick: () -> Unit,
) {
    val colors = AppTheme.colors
    var menuOpen by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .widthIn(min = SPLIT_MIN_WIDTH.dp)
            .heightIn(min = AppSizes.controlHeight)
            .clip(MaterialTheme.shapes.medium)
            .background(colors.accent),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .clickable { onClick() },
            contentAlignment = Alignment.Center,
        ) {
            Text(label, style = MaterialTheme.typography.labelLarge, color = colors.onAccent)
        }

        Box(
            Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(Color.White.copy(alpha = SPLIT_DIVIDER_ALPHA)),
        )

        Box {
            Box(
                modifier = Modifier
                    .width(AppSizes.chipHeight)
                    .fillMaxHeight()
                    .clickable { menuOpen = true },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.MoreHoriz,
                    contentDescription = label,
                    tint = colors.onAccent,
                    modifier = Modifier.size(AppSizes.tableIcon),
                )
            }

            DropdownMenu(
                expanded = menuOpen,
                onDismissRequest = { menuOpen = false },
            ) {
                DropdownMenuItem(
                    text = { Text(menuLabel, style = MaterialTheme.typography.bodyMedium) },
                    onClick = {
                        menuOpen = false
                        onMenuClick()
                    },
                )
            }
        }
    }
}
