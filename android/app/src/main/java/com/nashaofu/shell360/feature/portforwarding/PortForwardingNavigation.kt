package com.nashaofu.shell360.feature.portforwarding

import androidx.compose.runtime.Composable

const val PortForwardingRoute = "port-forwarding"

@Composable
fun PortForwardingDestination(onOpenNavigation: () -> Unit) {
    PortForwardingScreen(onOpenNavigation = onOpenNavigation)
}
