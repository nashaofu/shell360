package com.nashaofu.shell360.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.ui.theme.ThemeMode

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun SettingsScreen(
    viewModel: SettingsViewModel = remember { SettingsViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onOpenNavigation) { Icon(Icons.Default.Menu, "Open navigation menu") } },
                title = { Text("Settings") },
            )
        },
        snackbarHost = {
            state.feedbackMessage?.let { message ->
                Snackbar(action = { TextButton(onClick = { viewModel.onAction(SettingsAction.FeedbackDismissed) }) { Text("Dismiss") } }) { Text(message) }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            SettingsSection("Appearance") {
                SettingsCard {
                    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ThemeMode.entries.forEach { mode ->
                            FilterChip(selected = state.themeMode == mode, onClick = { viewModel.onAction(SettingsAction.ThemeSelected(mode)) }, label = { Text(mode.label) })
                        }
                    }
                }
            }
            SettingsSection("Data") {
                SettingsCard {
                    SettingsRow("Export configuration", Icons.Default.Download) { viewModel.onAction(SettingsAction.ExportClicked) }
                    SettingsRow("Import configuration", Icons.Default.Upload) { viewModel.onAction(SettingsAction.ImportClicked) }
                    SettingsRow("Reset app data", Icons.Default.Security, destructive = true) { viewModel.onAction(SettingsAction.ResetClicked) }
                }
            }
            SettingsSection("Security") {
                SettingsCard {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Security, "Security", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Encrypted configuration", Modifier.weight(1f).padding(start = 12.dp))
                        Switch(checked = state.cryptoEnabled, onCheckedChange = { viewModel.onAction(SettingsAction.CryptoToggleClicked) })
                    }
                    SettingsRow("Password and biometric unlock", Icons.AutoMirrored.Filled.ArrowForwardIos) { viewModel.onAction(SettingsAction.CryptoToggleClicked) }
                }
            }
            SettingsSection("About") {
                SettingsCard {
                    SettingsRow("Privacy Policy", Icons.AutoMirrored.Filled.ArrowForwardIos) { viewModel.onAction(SettingsAction.PrivacyPolicyClicked) }
                    SettingsRow("About Shell360", Icons.Default.Info) { viewModel.onAction(SettingsAction.AboutClicked) }
                    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Version")
                        Text("Native Android UI", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
    when (state.dialog) {
        SettingsDialog.Import -> AlertDialog(onDismissRequest = { viewModel.onAction(SettingsAction.DialogDismissed) }, title = { Text("Import configuration?") }, text = { Text("Imported hosts, keys, and port forwarding configurations will be added to existing data when Android storage is connected.") }, confirmButton = { TextButton(onClick = { viewModel.onAction(SettingsAction.ConfirmImport) }) { Text("Continue") } }, dismissButton = { TextButton(onClick = { viewModel.onAction(SettingsAction.DialogDismissed) }) { Text("Cancel") } })
        SettingsDialog.Reset -> AlertDialog(onDismissRequest = { viewModel.onAction(SettingsAction.DialogDismissed) }, title = { Text("Reset app data?") }, text = { Text("This will delete hosts, keys, and port forwarding configurations. Android reset capability is not connected yet.") }, confirmButton = { TextButton(onClick = { viewModel.onAction(SettingsAction.ConfirmReset) }) { Text("Reset") } }, dismissButton = { TextButton(onClick = { viewModel.onAction(SettingsAction.DialogDismissed) }) { Text("Cancel") } })
        null -> Unit
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        content()
    }
}

@Composable
private fun SettingsCard(content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), content = { Column { content() } })
}

@Composable
private fun SettingsRow(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, destructive: Boolean = false, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        Icon(icon, contentDescription = label, tint = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
        Text(label, Modifier.weight(1f).padding(start = 12.dp), color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
    }
}
