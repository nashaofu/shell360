package com.nashaofu.shell360.feature.sftp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.FilterChip
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SftpScreen(viewModel: SftpViewModel = remember { SftpViewModel() }) {
    val state = viewModel.uiState
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.Folder, "SFTP files", tint = androidx.compose.material3.MaterialTheme.colorScheme.primary)
            Text("SFTP", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = state.pathDraft,
                onValueChange = { viewModel.onAction(SftpAction.PathChanged(it)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Remote path") },
                trailingIcon = {
                    TextButton(onClick = { viewModel.onAction(SftpAction.NavigatePathRequested) }) { Text("Go") }
                },
            )
            Text("Current path: ${state.path}", color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onAction(SftpAction.QueryChanged(it)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Search files") },
                trailingIcon = if (state.query.isNotEmpty()) {
                    { TextButton(onClick = { viewModel.onAction(SftpAction.QueryChanged("")) }) { Text("Clear") } }
                } else null,
            )
            FilterChip(
                selected = state.showHiddenFiles,
                onClick = { viewModel.onAction(SftpAction.ToggleHiddenFiles) },
                label = { Text("Show hidden files") },
            )
            Text(
                state.errorMessage ?: "Ready",
                color = if (state.errorMessage == null) androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant else androidx.compose.material3.MaterialTheme.colorScheme.error,
                style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
            )
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(onClick = { viewModel.onAction(SftpAction.Refresh) }) { Icon(Icons.Default.Refresh, "Refresh files") }
                IconButton(onClick = { viewModel.onAction(SftpAction.UploadRequested) }) { Icon(Icons.Default.CloudUpload, "Upload file") }
                IconButton(onClick = { viewModel.onAction(SftpAction.MoreActionsRequested) }) { Icon(Icons.Default.MoreVert, "More SFTP actions") }
            }
            Surface(
                color = androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant,
                shape = androidx.compose.material3.MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("No remote files to show", style = androidx.compose.material3.MaterialTheme.typography.titleMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    Text(
                        "Connect the Android SFTP runtime to browse folders, upload files, and manage transfers.",
                        color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
        }
    }
}
