package com.nashaofu.shell360

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.alpha
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Router
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import com.nashaofu.shell360.feature.hosts.HostsScreen

private enum class Route(val title: String) {
    Workspace("Workspace"),
    Hosts("Hosts"),
    PortForwardings("Port Forwardings"),
    Keys("Keys"),
    KnownHosts("Known Hosts"),
    Settings("Settings"),
}

private val Route.description: String
    get() = when (this) {
        Route.Workspace -> "Your active SSH and SFTP sessions appear here."
        Route.Hosts -> "Connect to your saved SSH hosts from one place."
        Route.PortForwardings -> "Create and manage secure local and remote tunnels."
        Route.Keys -> "Keep the keys used to authenticate your connections."
        Route.KnownHosts -> "Review trusted host fingerprints and identities."
        Route.Settings -> "Tune Shell360 to match the way you work."
    }

private fun Route.icon() = when (this) {
    Route.Workspace -> Icons.Filled.Terminal
    Route.Hosts -> Icons.Filled.Router
    Route.PortForwardings -> Icons.Filled.AccountTree
    Route.Keys -> Icons.Filled.Key
    Route.KnownHosts -> Icons.Filled.VerifiedUser
    Route.Settings -> Icons.Filled.Settings
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun Shell360Navigation() {
    var currentRoute by remember { mutableStateOf(Route.Hosts) }
    val hasOpenSessions = false
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val menuScrollState = rememberScrollState()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Column(modifier = Modifier.fillMaxHeight()) {
                    Column(modifier = Modifier.padding(vertical = 20.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 24.dp),
                        ) {
                            Surface(
                                modifier = Modifier.size(42.dp),
                                shape = RoundedCornerShape(12.dp),
                                color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Filled.Terminal,
                                        contentDescription = null,
                                        tint = androidx.compose.material3.MaterialTheme.colorScheme.onPrimary,
                                    )
                                }
                            }
                            Column(modifier = Modifier.padding(start = 12.dp)) {
                                Text(
                                    text = "Shell360",
                                    style = androidx.compose.material3.MaterialTheme.typography.titleLarge,
                                )
                                Text(
                                    text = "SSH & SFTP client",
                                    style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                                    color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 20.dp))
                    Column {
                        Text(
                            text = "WORKSPACE",
                            style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
                            color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 28.dp),
                        )
                        DrawerRouteItem(
                            destination = Route.Workspace,
                            selected = currentRoute == Route.Workspace,
                            enabled = hasOpenSessions,
                            onClick = {
                                currentRoute = Route.Workspace
                                scope.launch { drawerState.close() }
                            },
                        )
                    }
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(menuScrollState),
                    ) {
                        Column {
                            Text(
                                text = "MANAGE",
                                style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
                                color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(horizontal = 28.dp, vertical = 6.dp),
                            )
                            Route.entries
                                .filter { it != Route.Workspace && it != Route.Settings }
                                .forEach { destination ->
                                    DrawerRouteItem(
                                        destination = destination,
                                        selected = destination == currentRoute,
                                        onClick = {
                                            currentRoute = destination
                                            scope.launch { drawerState.close() }
                                        },
                                    )
                                }
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 24.dp))
                    DrawerRouteItem(
                        destination = Route.Settings,
                        selected = currentRoute == Route.Settings,
                        onClick = {
                            currentRoute = Route.Settings
                            scope.launch { drawerState.close() }
                        },
                    )
                }
            }
        },
    ) {
        Scaffold(
            topBar = {
                if (currentRoute != Route.Hosts) {
                    PageHeader(
                        route = currentRoute,
                        onOpenNavigation = { scope.launch { drawerState.open() } },
                    )
                }
            },
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surfaceContainerLowest,
        ) { contentPadding ->
            RouteScreen(
                modifier = Modifier.padding(contentPadding),
                route = currentRoute,
                onOpenNavigation = { scope.launch { drawerState.open() } },
            )
        }
    }
}

@Composable
private fun PageHeader(
    route: Route,
    onOpenNavigation: () -> Unit,
) {
    Surface(
        color = androidx.compose.material3.MaterialTheme.colorScheme.surfaceContainer,
        tonalElevation = 2.dp,
        shadowElevation = 2.dp,
    ) {
        Column(modifier = Modifier.statusBarsPadding()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onOpenNavigation) {
                    Icon(
                        imageVector = Icons.Filled.Menu,
                        contentDescription = "Open navigation menu",
                    )
                }
                Text(
                    text = route.title,
                    style = androidx.compose.material3.MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun DrawerRouteItem(
    destination: Route,
    selected: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    NavigationDrawerItem(
        icon = {
            Icon(
                imageVector = destination.icon(),
                contentDescription = null,
            )
        },
        label = { Text(destination.title) },
        selected = selected,
        onClick = if (enabled) onClick else ({}),
        modifier = Modifier
            .padding(horizontal = 12.dp)
            .alpha(if (enabled) 1f else 0.45f),
    )
}

@Composable
private fun RouteScreen(
    route: Route,
    modifier: Modifier = Modifier,
    onOpenNavigation: () -> Unit,
) {
    if (route == Route.Hosts) {
        HostsScreen(onOpenNavigation = onOpenNavigation)
        return
    }
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = "${route.title.uppercase()} / OVERVIEW",
            style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
            color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
        )
        Surface(
            modifier = Modifier.size(80.dp),
            shape = RoundedCornerShape(24.dp),
            color = androidx.compose.material3.MaterialTheme.colorScheme.primaryContainer,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "•",
                    style = androidx.compose.material3.MaterialTheme.typography.displaySmall,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = route.title,
                style = androidx.compose.material3.MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "Ready when you are",
                style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
                color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        ElevatedCard(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
        ) {
            Text(
                text = route.description,
                style = androidx.compose.material3.MaterialTheme.typography.bodyLarge,
                color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 18.dp),
            )
        }
    }
}
