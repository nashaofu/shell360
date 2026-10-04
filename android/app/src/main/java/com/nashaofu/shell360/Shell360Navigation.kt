package com.nashaofu.shell360

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nashaofu.shell360.app.navigation.Shell360NavHost
import com.nashaofu.shell360.app.navigation.SidebarPanel
import com.nashaofu.shell360.app.navigation.TopLevelDestination
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.feature.unlock.UnlockScreen
import com.nashaofu.shell360.ui.theme.AppSizes
import kotlinx.coroutines.launch

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun Shell360Navigation() {
    if (!Shell360Store.runtimeReady) {
        val error = Shell360Store.runtimeError
        val context = LocalContext.current
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (error == null) {
                CircularProgressIndicator()
                Text("Preparing secure storage…")
            } else {
                Text("Secure storage unavailable")
                Text(error)
                Button(onClick = { AndroidRuntime.scope.launch { AndroidRuntime.start(context.applicationContext) } }) {
                    Text("Retry")
                }
            }
        }
        return
    }
    if (Shell360Store.cryptoEnabled && !Shell360Store.authed) {
        UnlockScreen()
        return
    }

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
    val activity = LocalContext.current.findActivity()
    val isTablet = LocalConfiguration.current.screenWidthDp >= AppSizes.wideScreenBreakpoint.value.toInt()

    // Webview `backToBackground`: at the root the back key leaves the app in the task
    // list instead of finishing it. Inner handlers are registered later and win.
    BackHandler {
        activity?.moveTaskToBack(true)
    }

    if (isTablet) {
        Row(Modifier.fillMaxSize()) {
            SidebarPanel(
                expanded = drawerState.isOpen,
                currentRoute = currentRoute,
                onNavigate = navigateToTopLevel,
                applySafeAreaInset = true,
            )
            Shell360NavHost(
                navController = navController,
                modifier = Modifier.weight(1f),
                onOpenNavigation = {
                    scope.launch {
                        if (drawerState.isOpen) drawerState.close() else drawerState.open()
                    }
                },
            )
        }
        return
    }

    BackHandler(enabled = drawerState.isOpen) {
        scope.launch { drawerState.close() }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                SidebarPanel(
                    expanded = true,
                    currentRoute = currentRoute,
                    onNavigate = { destination ->
                        navigateToTopLevel(destination)
                        scope.launch { drawerState.close() }
                    },
                )
            }
        },
    ) {
        Scaffold(
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
        ) { contentPadding ->
            Shell360NavHost(
                modifier = Modifier.padding(contentPadding),
                navController = navController,
                onOpenNavigation = { scope.launch { drawerState.open() } },
            )
        }
    }
}

private fun Context.findActivity(): Activity? {
    var context: Context = this
    while (context is ContextWrapper) {
        if (context is Activity) return context
        context = context.baseContext
    }
    return null
}
