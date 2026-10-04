package com.nashaofu.shell360.feature.workspace

import androidx.compose.runtime.Composable

const val WorkspaceRoute = "workspace"

@Composable
fun WorkspaceDestination(
    onOpenNavigation: () -> Unit,
    onBrowseHosts: () -> Unit = {},
    initialSessionId: String? = null,
) {
    WorkspaceScreen(
        onOpenNavigation = onOpenNavigation,
        onBrowseHosts = onBrowseHosts,
        initialSessionId = initialSessionId,
    )
}
