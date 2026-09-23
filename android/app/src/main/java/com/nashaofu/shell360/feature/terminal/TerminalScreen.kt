package com.nashaofu.shell360.feature.terminal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun TerminalScreen(
    viewModel: TerminalViewModel = remember { TerminalViewModel() },
) {
    val state = viewModel.uiState
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Default.Terminal, "Terminal", tint = MaterialTheme.colorScheme.primary)
            Text("Terminal", style = MaterialTheme.typography.titleLarge)
            Text(
                when (state.status) {
                    TerminalStatus.Connecting -> "Connecting"
                    TerminalStatus.Connected -> "Connected"
                    TerminalStatus.Error -> "Connection error"
                },
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelLarge,
            )
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainerLowest,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    state.errorMessage ?: "Terminal output will appear here when the Android runtime is connected.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
            }
            OutlinedButton(onClick = { viewModel.onAction(TerminalAction.Retry) }) {
                Icon(Icons.Default.Refresh, "Retry terminal")
                Text("Retry")
            }
            Button(onClick = { viewModel.onAction(TerminalAction.ToggleKeyboard) }) {
                Icon(Icons.Default.Keyboard, "Virtual keyboard")
                Text(if (state.virtualKeyboardVisible) "Hide virtual keyboard" else "Show virtual keyboard")
            }
            if (state.virtualKeyboardVisible) {
                Text(
                    "Virtual keyboard controls will be available when terminal transport is connected.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
