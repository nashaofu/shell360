package com.nashaofu.shell360.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.nashaofu.shell360.feature.hosts.HostsDestination
import com.nashaofu.shell360.feature.hosts.HostEditorDestination
import com.nashaofu.shell360.feature.keys.KeysDestination
import com.nashaofu.shell360.feature.keys.KeyEditorDestination
import com.nashaofu.shell360.feature.knownhosts.KnownHostsDestination
import com.nashaofu.shell360.feature.portforwarding.PortForwardingDestination
import com.nashaofu.shell360.feature.settings.SettingsDestination
import com.nashaofu.shell360.feature.workspace.WorkspaceDestination

@Composable
fun Shell360NavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    onOpenNavigation: () -> Unit,
) {
    NavHost(
        navController = navController,
        startDestination = TopLevelDestination.Hosts.route,
        modifier = modifier,
    ) {
        composable(TopLevelDestination.Hosts.route) {
            HostsDestination(
                onOpenNavigation = onOpenNavigation,
                onOpenSession = { sessionId ->
                    navController.navigate("${TopLevelDestination.Workspace.route}?sessionId=$sessionId") {
                        launchSingleTop = true
                    }
                },
                onAddHost = { navController.navigate("hosts/edit") },
                onEditHost = { id -> navController.navigate("hosts/edit?hostId=$id") },
            )
        }
        composable("hosts/edit?hostId={hostId}") { entry ->
            HostEditorDestination(navController, entry.arguments?.getString("hostId"))
        }
        composable(TopLevelDestination.PortForwardings.route) { PortForwardingDestination(onOpenNavigation) }
        composable(TopLevelDestination.Keys.route) {
            KeysDestination(onOpenNavigation, onAddKey = { navController.navigate("keys/edit") }, onEditKey = { id -> navController.navigate("keys/edit?keyId=$id") })
        }
        composable("keys/edit?keyId={keyId}") { entry ->
            KeyEditorDestination(navController, entry.arguments?.getString("keyId"))
        }
        composable(TopLevelDestination.KnownHosts.route) { KnownHostsDestination(onOpenNavigation) }
        composable(TopLevelDestination.Settings.route) { SettingsDestination(onOpenNavigation) }
        composable("${TopLevelDestination.Workspace.route}?sessionId={sessionId}") { entry ->
            WorkspaceDestination(
                onOpenNavigation = onOpenNavigation,
                onBrowseHosts = {
                    navController.navigate(TopLevelDestination.Hosts.route) {
                        launchSingleTop = true
                    }
                },
                initialSessionId = entry.arguments?.getString("sessionId"),
            )
        }
    }
}
