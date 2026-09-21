package com.nashaofu.shell360.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import android.os.Build
import androidx.compose.ui.platform.LocalContext

val ColorScheme.mobileFrame: Color
    get() = if (background.luminance() > 0.5f) Color(0xFFEDF1EE) else Color(0xFF191E1B)

private val MobileLightColors = lightColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFF247A4E),
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = androidx.compose.ui.graphics.Color(0xFFD9F2E2),
    onPrimaryContainer = androidx.compose.ui.graphics.Color(0xFF155735),
    secondary = androidx.compose.ui.graphics.Color(0xFF527568),
    onSecondary = androidx.compose.ui.graphics.Color.White,
    secondaryContainer = androidx.compose.ui.graphics.Color(0xFFE5F0EA),
    onSecondaryContainer = androidx.compose.ui.graphics.Color(0xFF27483A),
    background = androidx.compose.ui.graphics.Color(0xFFF7F9F7),
    onBackground = androidx.compose.ui.graphics.Color(0xFF17201B),
    surface = androidx.compose.ui.graphics.Color(0xFFFFFFFF),
    onSurface = androidx.compose.ui.graphics.Color(0xFF17201B),
    surfaceVariant = androidx.compose.ui.graphics.Color(0xFFEEF3EF),
    onSurfaceVariant = androidx.compose.ui.graphics.Color(0xFF5F6B63),
    outline = androidx.compose.ui.graphics.Color(0xFFD4DED7),
    outlineVariant = androidx.compose.ui.graphics.Color(0xFFE5EBE7),
)

private val MobileDarkColors = darkColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFF78D6A0),
    onPrimary = androidx.compose.ui.graphics.Color(0xFF00391F),
    primaryContainer = androidx.compose.ui.graphics.Color(0xFF214936),
    onPrimaryContainer = androidx.compose.ui.graphics.Color(0xFFB7F1C9),
    secondary = androidx.compose.ui.graphics.Color(0xFFA8CCBA),
    onSecondary = androidx.compose.ui.graphics.Color(0xFF16372A),
    secondaryContainer = androidx.compose.ui.graphics.Color(0xFF29483A),
    onSecondaryContainer = androidx.compose.ui.graphics.Color(0xFFD0EBDD),
    background = androidx.compose.ui.graphics.Color(0xFF101411),
    onBackground = androidx.compose.ui.graphics.Color(0xFFEDF3EF),
    surface = androidx.compose.ui.graphics.Color(0xFF191F1B),
    onSurface = androidx.compose.ui.graphics.Color(0xFFEDF3EF),
    surfaceVariant = androidx.compose.ui.graphics.Color(0xFF222A25),
    onSurfaceVariant = androidx.compose.ui.graphics.Color(0xFFAAB5AE),
    outline = androidx.compose.ui.graphics.Color(0xFF3A473E),
    outlineVariant = androidx.compose.ui.graphics.Color(0xFF2C362F),
)

/** Values mirror the semantic tokens and component radii in mobile/src/styles. */
val Shell360Shapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(6.dp),
    small = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    large = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
)

val Shell360Typography = Typography().run {
    copy(
        bodyLarge = bodyLarge.copy(fontSize = 15.sp, lineHeight = 22.sp),
        bodyMedium = bodyMedium.copy(fontSize = 14.sp, lineHeight = 21.sp),
        bodySmall = bodySmall.copy(fontSize = 12.sp, lineHeight = 18.sp),
        titleLarge = titleLarge.copy(fontSize = 20.sp, lineHeight = 26.sp),
        titleMedium = titleMedium.copy(fontSize = 17.sp, lineHeight = 22.sp),
        labelLarge = labelLarge.copy(fontSize = 14.sp, lineHeight = 20.sp),
        labelSmall = labelSmall.copy(fontSize = 11.sp, lineHeight = 16.sp),
    )
}

@Composable
fun Shell360Theme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val useDynamicColor = dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val context = LocalContext.current
    val colorScheme = when {
        useDynamicColor && darkTheme -> dynamicDarkColorScheme(context)
        useDynamicColor -> dynamicLightColorScheme(context)
        darkTheme -> MobileDarkColors
        else -> MobileLightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        shapes = Shell360Shapes,
        typography = Shell360Typography,
        content = content,
    )
}
