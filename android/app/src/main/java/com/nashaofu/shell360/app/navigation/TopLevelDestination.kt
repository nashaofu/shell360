package com.nashaofu.shell360.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Router
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.ui.graphics.vector.ImageVector

enum class TopLevelDestination(val title: String, val route: String) {
    Workspace("Workspace", "workspace"),
    Hosts("Hosts", "hosts"),
    PortForwardings("Port Forwarding", "port-forwarding"),
    Keys("Keys", "keys"),
    KnownHosts("Known Hosts", "known-hosts"),
    Settings("Settings", "settings"),
}

val TopLevelDestination.description: String
    get() = when (this) {
        TopLevelDestination.Workspace -> "Your active SSH and SFTP sessions appear here."
        TopLevelDestination.Hosts -> "Connect to your saved SSH hosts from one place."
        TopLevelDestination.PortForwardings -> "Create and manage secure local and remote tunnels."
        TopLevelDestination.Keys -> "Keep the keys used to authenticate your connections."
        TopLevelDestination.KnownHosts -> "Review trusted host fingerprints and identities."
        TopLevelDestination.Settings -> "Tune Shell360 to match the way you work."
    }

fun TopLevelDestination.icon(): ImageVector = when (this) {
    TopLevelDestination.Workspace -> Icons.Filled.Terminal
    TopLevelDestination.Hosts -> Icons.Filled.Router
    TopLevelDestination.PortForwardings -> Icons.Filled.AccountTree
    TopLevelDestination.Keys -> Icons.Filled.Key
    TopLevelDestination.KnownHosts -> Icons.Filled.VerifiedUser
    TopLevelDestination.Settings -> Icons.Filled.Settings
}
