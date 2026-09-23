package com.nashaofu.shell360.feature.settings

import androidx.compose.runtime.Composable

const val SettingsRoute = "settings"

@Composable
fun SettingsDestination(onOpenNavigation: () -> Unit) {
    SettingsScreen(onOpenNavigation = onOpenNavigation)
}
