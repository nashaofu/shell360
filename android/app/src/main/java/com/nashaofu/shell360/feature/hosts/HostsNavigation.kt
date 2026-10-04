package com.nashaofu.shell360.feature.hosts

import androidx.compose.runtime.Composable
import com.nashaofu.shell360.core.data.HostModel
import com.nashaofu.shell360.core.data.SessionKind
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.app.navigation.TopLevelDestination
import androidx.navigation.NavHostController

const val HostsRoute = "hosts"

@Composable
fun HostsDestination(
    onOpenNavigation: () -> Unit,
    onOpenSession: (String) -> Unit = {},
    onAddHost: () -> Unit = {},
    onEditHost: (String) -> Unit = {},
) {
    HostsScreen(
        onOpenNavigation = onOpenNavigation,
        onOpenSession = onOpenSession,
        onAddHost = onAddHost,
        onEditHost = onEditHost,
    )
}

@Composable
fun HostEditorDestination(navController: NavHostController, hostId: String?) {
    HostEditorDrawer(
        open = true,
        data = hostId?.let { id -> Shell360Store.hosts.firstOrNull { it.id == id } },
        fullscreen = true,
        onCancel = { navController.popBackStack() },
        onSaved = { host, connect ->
            navController.popBackStack()
            if (connect) {
                val session = Shell360Store.openSession(host, SessionKind.Terminal)
                navController.navigate("${TopLevelDestination.Workspace.route}?sessionId=${session.id}") {
                    launchSingleTop = true
                }
            }
        },
        onOpenAddKey = {},
    )
}
