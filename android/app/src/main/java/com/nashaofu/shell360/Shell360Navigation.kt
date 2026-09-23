package com.nashaofu.shell360

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.alpha
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.DrawerValue
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
import androidx.compose.runtime.remember
import androidx.activity.compose.BackHandler
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.WindowInsets
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import androidx.navigation.compose.rememberNavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.nashaofu.shell360.app.navigation.TopLevelDestination
import com.nashaofu.shell360.app.navigation.Shell360NavHost
import com.nashaofu.shell360.app.navigation.description
import com.nashaofu.shell360.app.navigation.icon

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun Shell360Navigation() {
    val navController = rememberNavController()
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route
        ?: TopLevelDestination.Hosts.route
    val navigateToTopLevel: (TopLevelDestination) -> Unit = { destination ->
        navController.navigate(destination.route) {
            popUpTo(TopLevelDestination.Hosts.route) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val menuScrollState = rememberScrollState()

    BackHandler(enabled = drawerState.isOpen) {
        scope.launch { drawerState.close() }
    }

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
                            destination = TopLevelDestination.Workspace,
                            selected = currentRoute == TopLevelDestination.Workspace.route,
                            onClick = {
                                navigateToTopLevel(TopLevelDestination.Workspace)
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
                            TopLevelDestination.entries
                                .filter { it != TopLevelDestination.Workspace && it != TopLevelDestination.Settings }
                                .forEach { destination ->
                                    DrawerRouteItem(
                                        destination = destination,
                                        selected = destination.route == currentRoute,
                                        onClick = {
                                            navigateToTopLevel(destination)
                                            scope.launch { drawerState.close() }
                                        },
                                    )
                                }
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 24.dp))
                    DrawerRouteItem(
                        destination = TopLevelDestination.Settings,
                        selected = currentRoute == TopLevelDestination.Settings.route,
                        onClick = {
                            navigateToTopLevel(TopLevelDestination.Settings)
                            scope.launch { drawerState.close() }
                        },
                    )
                }
            }
        },
    ) {
        Scaffold(
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surfaceContainerLowest,
        ) { contentPadding ->
            Shell360NavHost(
                modifier = Modifier.padding(contentPadding),
                navController = navController,
                onOpenNavigation = { scope.launch { drawerState.open() } },
            )
        }
    }
}

@Composable
private fun DrawerRouteItem(
    destination: TopLevelDestination,
    selected: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    NavigationDrawerItem(
        icon = {
            Icon(
                imageVector = destination.icon(),
                contentDescription = destination.title,
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
