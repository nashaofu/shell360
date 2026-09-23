package com.nashaofu.shell360.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = ShellDarkGreen,
    onPrimary = ShellDarkOnGreen,
    primaryContainer = ShellDarkGreenContainer,
    onPrimaryContainer = ShellDarkOnGreenContainer,
    secondary = ShellDarkSecondary,
    onSecondary = ShellDarkOnSecondary,
    secondaryContainer = ShellDarkSecondaryContainer,
    onSecondaryContainer = ShellDarkOnSecondaryContainer,
    background = ShellDarkBackground,
    onBackground = ShellDarkOnBackground,
    surface = ShellDarkSurface,
    onSurface = ShellDarkOnSurface,
    surfaceVariant = ShellDarkSurfaceVariant,
    onSurfaceVariant = ShellDarkOnSurfaceVariant,
    outline = ShellDarkOutline,
    outlineVariant = ShellDarkOutlineVariant,
    error = ShellDarkError,
    onError = ShellDarkOnError,
    errorContainer = ShellDarkErrorContainer,
    onErrorContainer = ShellDarkOnErrorContainer,
)

private val LightColorScheme = lightColorScheme(
    primary = ShellGreen,
    onPrimary = ShellOnGreen,
    primaryContainer = ShellGreenContainer,
    onPrimaryContainer = ShellOnGreenContainer,
    secondary = ShellSecondary,
    onSecondary = ShellOnSecondary,
    secondaryContainer = ShellSecondaryContainer,
    onSecondaryContainer = ShellOnSecondaryContainer,
    background = ShellBackground,
    onBackground = ShellOnBackground,
    surface = ShellSurface,
    onSurface = ShellOnSurface,
    surfaceVariant = ShellSurfaceVariant,
    onSurfaceVariant = ShellOnSurfaceVariant,
    outline = ShellOutline,
    outlineVariant = ShellOutlineVariant,
    error = ShellError,
    onError = ShellOnError,
    errorContainer = ShellErrorContainer,
    onErrorContainer = ShellOnErrorContainer,
)

@Composable
fun Shell360Theme(
    themeMode: ThemeMode = ThemePreferences.mode,
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val darkTheme = when (themeMode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
    }
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
