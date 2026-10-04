package com.nashaofu.shell360.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

data class TypeToken(
    val size: Int,
    val lineHeight: Int,
    val letterSpacing: Double,
    val weight: Int,
)

/** Mirror of `design/tokens.json` (`typography`) — Material 3 baseline scale. */
val TypeTokens: Map<String, TypeToken> = mapOf(
    "displayLarge" to TypeToken(57, 64, -0.25, 400),
    "displayMedium" to TypeToken(45, 52, 0.0, 400),
    "displaySmall" to TypeToken(36, 44, 0.0, 400),
    "headlineLarge" to TypeToken(32, 40, 0.0, 600),
    "headlineMedium" to TypeToken(28, 36, 0.0, 600),
    "headlineSmall" to TypeToken(24, 32, 0.0, 600),
    "titleLarge" to TypeToken(22, 28, 0.0, 600),
    "titleMedium" to TypeToken(16, 24, 0.15, 600),
    "titleSmall" to TypeToken(14, 20, 0.1, 600),
    "bodyLarge" to TypeToken(16, 24, 0.5, 400),
    "bodyMedium" to TypeToken(14, 20, 0.25, 400),
    "bodySmall" to TypeToken(12, 16, 0.4, 400),
    "labelLarge" to TypeToken(14, 20, 0.1, 600),
    "labelMedium" to TypeToken(12, 16, 0.5, 500),
    "labelSmall" to TypeToken(11, 16, 0.5, 500),
)

private fun TypeToken.toTextStyle(): TextStyle = TextStyle(
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    letterSpacing = letterSpacing.sp,
    fontWeight = FontWeight(weight),
)

val Typography = Typography(
    displayLarge = TypeTokens.getValue("displayLarge").toTextStyle(),
    displayMedium = TypeTokens.getValue("displayMedium").toTextStyle(),
    displaySmall = TypeTokens.getValue("displaySmall").toTextStyle(),
    headlineLarge = TypeTokens.getValue("headlineLarge").toTextStyle(),
    headlineMedium = TypeTokens.getValue("headlineMedium").toTextStyle(),
    headlineSmall = TypeTokens.getValue("headlineSmall").toTextStyle(),
    titleLarge = TypeTokens.getValue("titleLarge").toTextStyle(),
    titleMedium = TypeTokens.getValue("titleMedium").toTextStyle(),
    titleSmall = TypeTokens.getValue("titleSmall").toTextStyle(),
    bodyLarge = TypeTokens.getValue("bodyLarge").toTextStyle(),
    bodyMedium = TypeTokens.getValue("bodyMedium").toTextStyle(),
    bodySmall = TypeTokens.getValue("bodySmall").toTextStyle(),
    labelLarge = TypeTokens.getValue("labelLarge").toTextStyle(),
    labelMedium = TypeTokens.getValue("labelMedium").toTextStyle(),
    labelSmall = TypeTokens.getValue("labelSmall").toTextStyle(),
)

/** Intent-named aliases so screens never hand-roll a size. Backed by the M3 scale. */
object AppType {
    val headerTitle: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.titleLarge

    val headerSubtitle: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.bodySmall

    val cardTitle: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.titleMedium

    val itemTitle: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.titleMedium

    val body: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.bodyMedium

    val bodyStrong: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.titleSmall

    val caption: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.bodySmall

    val mono: TextStyle
        @Composable @ReadOnlyComposable
        get() = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace)

    val buttonLabel: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.labelLarge

    val sectionLabel: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.labelMedium

    val groupLabel: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.labelSmall

    val badge: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.labelSmall

    val badgeSmall: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.labelSmall

    val brand: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.titleLarge

    val emptyTitle: TextStyle
        @Composable @ReadOnlyComposable get() = MaterialTheme.typography.titleMedium
}
