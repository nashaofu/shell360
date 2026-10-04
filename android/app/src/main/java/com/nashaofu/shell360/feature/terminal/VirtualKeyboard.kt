package com.nashaofu.shell360.feature.terminal

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme

private const val KEYBOARD_MAX_WIDTH = 760
private const val ACTIVE_TINT_ALPHA = 0.12f

/**
 * Virtual keyboard mirroring `packages/shared/src/components/VirtualKeyboard`:
 * four switchable layouts, independently toggleable Ctrl/Shift/Alt modifiers, and the
 * byte sequence resolved per key by [resolveKeyOutput].
 */
@Composable
fun VirtualKeyboard(
    onInput: (String) -> Unit,
    modifier: Modifier = Modifier,
    applicationCursorKeys: Boolean = false,
) {
    val colors = AppTheme.colors
    var layout by remember { mutableStateOf(KeyboardLayout.Lowercase) }
    var modifiers by remember { mutableStateOf(KeyboardModifiers()) }
    val rows = KEYBOARD_LAYOUTS.getValue(layout)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .widthIn(max = KEYBOARD_MAX_WIDTH.dp)
            .clip(MaterialTheme.shapes.small)
            .background(colors.bgSubtle)
            .padding(AppSpacing.xs),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        rows.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                row.forEach { key ->
                    KeyCap(
                        key = key,
                        active = key.isActive(layout, modifiers),
                        onClick = {
                            when (key) {
                                is ModifierKey -> modifiers = modifiers.toggled(key.modifier)
                                is LayoutSwitchKey -> layout = key.target
                                else -> resolveKeyOutput(key, modifiers, applicationCursorKeys)?.let(onInput)
                            }
                        },
                    )
                }
            }
        }
    }
}

private fun KeyboardKey.isActive(layout: KeyboardLayout, modifiers: KeyboardModifiers): Boolean = when (this) {
    is ModifierKey -> when (modifier) {
        KeyboardModifier.Ctrl -> modifiers.ctrl
        KeyboardModifier.Shift -> modifiers.shift
        KeyboardModifier.Alt -> modifiers.alt
    }

    is LayoutSwitchKey -> target == KeyboardLayout.Lowercase && layout != KeyboardLayout.Lowercase
    else -> false
}

@Composable
private fun RowScope.KeyCap(
    key: KeyboardKey,
    active: Boolean,
    onClick: () -> Unit,
) {
    val colors = AppTheme.colors

    Box(
        modifier = Modifier
            .weight(key.grow)
            .height(AppSizes.keyboardKey)
            .clip(MaterialTheme.shapes.small)
            .background(if (active) colors.accent.copy(alpha = ACTIVE_TINT_ALPHA) else colors.bgSurface)
            .border(
                width = 1.dp,
                color = if (active) colors.accent else colors.borderSubtle,
                shape = MaterialTheme.shapes.small,
            )
            .clickable { onClick() }
            .padding(horizontal = AppSpacing.sm),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = key.label,
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            color = if (active) colors.accent else colors.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Clip,
        )
    }
}
