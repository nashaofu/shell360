package com.nashaofu.shell360.feature.workspace

import androidx.compose.runtime.Composable

const val WorkspaceRoute = "workspace"

@Composable
fun WorkspaceDestination(onOpenNavigation: () -> Unit) {
    WorkspaceScreen(onOpenNavigation = onOpenNavigation)
}
