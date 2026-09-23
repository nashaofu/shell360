package com.nashaofu.shell360.feature.knownhosts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun KnownHostsScreen(
    viewModel: KnownHostsViewModel = remember { KnownHostsViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onOpenNavigation) { Icon(Icons.Default.Menu, "Open navigation menu") } },
                title = { Text("Known Hosts") },
            )
        },
        snackbarHost = {
            state.feedbackMessage?.let { message ->
                Snackbar(action = { TextButton(onClick = { viewModel.onAction(KnownHostsAction.FeedbackDismissed) }) { Text("Dismiss") } }) { Text(message) }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = { viewModel.onAction(KnownHostsAction.QueryChanged(it)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, "Search known hosts") },
                trailingIcon = if (state.query.isNotEmpty()) {
                    { IconButton(onClick = { viewModel.onAction(KnownHostsAction.QueryChanged("")) }) { Icon(Icons.Default.Close, "Clear search") } }
                } else null,
                placeholder = { Text("Search hostname or fingerprint") },
            )
            when {
                state.isLoading -> androidx.compose.foundation.layout.Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.items.isEmpty() -> EmptyKnownHosts()
                viewModel.visibleItems.isEmpty() -> Text("No known hosts match your search.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(viewModel.visibleItems, key = { it.id }) { item ->
                        KnownHostCard(item) { viewModel.onAction(KnownHostsAction.DeleteClicked(item)) }
                    }
                }
            }
        }
    }
    state.pendingDelete?.let { item ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Delete known host") },
            text = { Text("Delete the trusted record for ${item.host}? This cannot be undone.") },
            confirmButton = { TextButton(onClick = viewModel::confirmDelete) { Text("Delete") } },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Cancel") } },
        )
    }
}

@Composable
private fun EmptyKnownHosts() {
    Column(Modifier.fillMaxSize().padding(bottom = 48.dp), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(Icons.Default.VerifiedUser, "Known Hosts", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 16.dp))
        Text("No known hosts", style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text("Trusted server identity records will appear here when Android storage is connected.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), textAlign = TextAlign.Center)
    }
}

@Composable
private fun KnownHostCard(item: KnownHostItem, onDelete: () -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(16.dp)) {
            Icon(
                Icons.Default.VerifiedUser,
                contentDescription = "Trusted host identity",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(end = 12.dp),
            )
            Column(Modifier.weight(1f)) {
                Text(item.host, style = MaterialTheme.typography.titleMedium)
                Text(fingerprintPreview(item.fingerprint), fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 6.dp))
                Text(item.type, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
            }
            IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More actions for ${item.host}") }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(text = { Text("Delete") }, onClick = { menuOpen = false; onDelete() }, leadingIcon = { Icon(Icons.Default.DeleteOutline, "Delete known host") })
            }
        }
    }
}

private fun fingerprintPreview(value: String): String =
    if (value.length <= 18) value else "${value.take(12)}...${value.takeLast(4)}"
