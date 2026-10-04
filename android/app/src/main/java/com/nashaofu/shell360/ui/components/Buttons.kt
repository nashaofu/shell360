package com.nashaofu.shell360.ui.components

import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppType

/**
 * Shell360 button contract. Material is only the rendering backend; dimensions,
 * shape and colors are owned by the cross-platform design tokens.
 */
private val AppButtonShape = RoundedCornerShape(AppSpacing.md)
private val AppButtonModifier = Modifier.defaultMinSize(minHeight = AppSizes.controlHeight)

@Composable
private fun RowScope.ButtonContent(content: @Composable RowScope.() -> Unit) {
    CompositionLocalProvider(LocalTextStyle provides AppType.buttonLabel) { content() }
}

@Composable
fun AppButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    Button(onClick = onClick, modifier = modifier.then(AppButtonModifier), enabled = enabled, shape = AppButtonShape, contentPadding = PaddingValues(horizontal = AppSpacing.lg, vertical = AppSpacing.sm)) { ButtonContent(content) }
}

@Composable
fun AppOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    OutlinedButton(onClick = onClick, modifier = modifier.then(AppButtonModifier), enabled = enabled, shape = AppButtonShape, contentPadding = PaddingValues(horizontal = AppSpacing.lg, vertical = AppSpacing.sm)) { ButtonContent(content) }
}

/** Material 3 filled-tonal button; `error` switches to the error container pair. */
@Composable
fun AppAccentButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    error: Boolean = false,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier.then(AppButtonModifier),
        enabled = enabled,
        colors = if (error) {
            ButtonDefaults.filledTonalButtonColors(
                containerColor = colors.errorContainer,
                contentColor = colors.onErrorContainer,
            )
        } else {
            ButtonDefaults.filledTonalButtonColors()
        },
        shape = AppButtonShape,
        contentPadding = PaddingValues(horizontal = AppSpacing.lg, vertical = AppSpacing.sm),
        content = { ButtonContent(content) },
    )
}

/** Filled-tonal on the secondary container, for low-emphasis actions. */
@Composable
fun AppSoftButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier.then(AppButtonModifier),
        enabled = enabled,
        shape = AppButtonShape,
        contentPadding = PaddingValues(horizontal = AppSpacing.lg, vertical = AppSpacing.sm),
        colors = ButtonDefaults.filledTonalButtonColors(
            containerColor = colors.secondaryContainer,
            contentColor = colors.onSecondaryContainer,
        ),
        content = { ButtonContent(content) },
    )
}

@Composable
fun AppTextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    danger: Boolean = false,
    content: @Composable RowScope.() -> Unit,
) {
    TextButton(
        onClick = onClick,
        modifier = modifier.defaultMinSize(minHeight = AppSizes.controlHeight),
        enabled = enabled,
        shape = AppButtonShape,
        contentPadding = PaddingValues(horizontal = AppSpacing.md, vertical = AppSpacing.sm),
        colors = if (danger) {
            ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
        } else {
            ButtonDefaults.textButtonColors()
        },
        content = { ButtonContent(content) },
    )
}

@Composable
fun AppIconButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: Color? = null,
    size: Dp? = null,
) {
    IconButton(
        onClick = onClick,
        modifier = if (size != null) modifier.size(size) else modifier,
        enabled = enabled,
    ) {
        if (tint != null) {
            Icon(icon, contentDescription, tint = tint)
        } else {
            Icon(icon, contentDescription)
        }
    }
}


