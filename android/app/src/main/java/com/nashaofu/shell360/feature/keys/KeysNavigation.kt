package com.nashaofu.shell360.feature.keys

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import com.nashaofu.shell360.core.data.Shell360Store

const val KeysRoute = "keys"

@Composable
fun KeysDestination(onOpenNavigation: () -> Unit, onAddKey: () -> Unit = {}, onEditKey: (String) -> Unit = {}) {
    KeysScreen(onOpenNavigation = onOpenNavigation, onAddKey = onAddKey, onEditKey = onEditKey)
}

@Composable
fun KeyEditorDestination(navController: NavHostController, keyId: String?) {
    KeyEditorDrawer(
        open = true,
        data = keyId?.let { id -> Shell360Store.keys.firstOrNull { it.id == id } },
        fullscreen = true,
        onCancel = { navController.popBackStack() },
        onSaved = { navController.popBackStack() },
    )
}
