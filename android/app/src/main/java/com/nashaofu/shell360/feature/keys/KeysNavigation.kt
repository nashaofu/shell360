package com.nashaofu.shell360.feature.keys

import androidx.compose.runtime.Composable

const val KeysRoute = "keys"

@Composable
fun KeysDestination(onOpenNavigation: () -> Unit) {
    KeysScreen(onOpenNavigation = onOpenNavigation)
}
