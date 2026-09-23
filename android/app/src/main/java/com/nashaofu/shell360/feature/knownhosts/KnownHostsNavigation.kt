package com.nashaofu.shell360.feature.knownhosts

import androidx.compose.runtime.Composable

const val KnownHostsRoute = "known-hosts"

@Composable
fun KnownHostsDestination(onOpenNavigation: () -> Unit) {
    KnownHostsScreen(onOpenNavigation = onOpenNavigation)
}
