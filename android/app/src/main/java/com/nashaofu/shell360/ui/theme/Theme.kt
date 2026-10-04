package com.nashaofu.shell360.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Shapes come from `design/tokens.json`; Material 3 baseline corners. */
val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(ShapeTokens.getValue("extraSmall").dp),
    small = RoundedCornerShape(ShapeTokens.getValue("small").dp),
    medium = RoundedCornerShape(ShapeTokens.getValue("medium").dp),
    large = RoundedCornerShape(ShapeTokens.getValue("large").dp),
    extraLarge = RoundedCornerShape(ShapeTokens.getValue("extraLarge").dp),
)

private fun colorSchemeOf(tokens: Map<String, Color>, dark: Boolean): ColorScheme {
    fun token(key: String): Color = tokens.getValue(key)
    val base = if (dark) darkColorScheme() else lightColorScheme()

    return base.copy(
        primary = token("primary"),
        onPrimary = token("onPrimary"),
        primaryContainer = token("primaryContainer"),
        onPrimaryContainer = token("onPrimaryContainer"),
        inversePrimary = token("inversePrimary"),
        secondary = token("secondary"),
        onSecondary = token("onSecondary"),
        secondaryContainer = token("secondaryContainer"),
        onSecondaryContainer = token("onSecondaryContainer"),
        tertiary = token("tertiary"),
        onTertiary = token("onTertiary"),
        tertiaryContainer = token("tertiaryContainer"),
        onTertiaryContainer = token("onTertiaryContainer"),
        error = token("error"),
        onError = token("onError"),
        errorContainer = token("errorContainer"),
        onErrorContainer = token("onErrorContainer"),
        background = token("background"),
        onBackground = token("onBackground"),
        surface = token("surface"),
        onSurface = token("onSurface"),
        surfaceVariant = token("surfaceVariant"),
        onSurfaceVariant = token("onSurfaceVariant"),
        surfaceTint = token("primary"),
        inverseSurface = token("inverseSurface"),
        inverseOnSurface = token("inverseOnSurface"),
        outline = token("outline"),
        outlineVariant = token("outlineVariant"),
        scrim = token("scrim"),
        surfaceBright = token("surfaceBright"),
        surfaceDim = token("surfaceDim"),
        surfaceContainer = token("surfaceContainer"),
        surfaceContainerHigh = token("surfaceContainerHigh"),
        surfaceContainerHighest = token("surfaceContainerHighest"),
        surfaceContainerLow = token("surfaceContainerLow"),
        surfaceContainerLowest = token("surfaceContainerLowest"),
    )
}

/**
 * Material 3 theme driven entirely by `design/tokens.json`.
 *
 * Material You dynamic colour is deliberately not used: it derives the palette from
 * the device wallpaper, so the same app would look different on every device and the
 * style could not stay consistent across Android / iOS / HarmonyOS.
 */
@Composable
fun Shell360Theme(
    themeMode: ThemeMode = ThemePreferences.mode,
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
    }
    val tokens = if (dark) DarkColorTokens else LightColorTokens
    val scheme = colorSchemeOf(tokens, dark)

    CompositionLocalProvider(LocalAppColors provides appColorsOf(scheme, tokens)) {
        MaterialTheme(
            colorScheme = scheme,
            typography = Typography,
            shapes = AppShapes,
            content = content,
        )
    }
}
