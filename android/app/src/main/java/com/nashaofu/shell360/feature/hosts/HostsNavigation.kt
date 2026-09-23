package com.nashaofu.shell360.feature.hosts

import androidx.compose.runtime.Composable

const val HostsRoute = "hosts"

@Composable
fun HostsDestination(onOpenNavigation: () -> Unit) {
    HostsScreen(onOpenNavigation = onOpenNavigation)
}
