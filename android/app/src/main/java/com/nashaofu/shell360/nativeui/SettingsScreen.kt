package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Slider
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import com.nashaofu.shell360.terminal.NativeRuntimeClient
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    runtime: NativeRuntimeClient,
    onBack: () -> Unit,
    onOpenDrawer: (() -> Unit)? = null,
    onExportData: (() -> Unit)? = null,
    onImportData: (() -> Unit)? = null,
    onResetAppData: (() -> Unit)? = null,
    onOpenUrl: ((String) -> Unit)? = null,
    version: String = "",
    appearance: String = "inherit",
    onAppearanceChange: (String) -> Unit = {},
    defaultFontSize: Int = 18,
    onDefaultFontSizeChange: (Int) -> Unit = {},
    defaultTerminalType: String = "xterm-256color",
    onDefaultTerminalTypeChange: (String) -> Unit = {},
    shortcutBar: Boolean = true,
    onShortcutBarChange: (Boolean) -> Unit = {},
) {
    var initialized by remember { mutableStateOf(false) }
    var cryptoEnabled by remember { mutableStateOf(true) }
    var authenticated by remember { mutableStateOf(false) }
    var password by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var confirmImport by remember { mutableStateOf(false) }
    var confirmReset by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    fun refresh() {
        runtime.request("data.checkIsEnableCrypto") { cryptoEnabled = it.optBoolean("data", true) }
        runtime.request("data.checkIsInitCrypto") { initialized = it.optBoolean("data") }
        runtime.request("data.checkIsAuthed") { authenticated = it.optBoolean("data") }
    }
    LaunchedEffect(Unit) { refresh() }
    Scaffold(topBar = { NativeTopBar("Settings", onBack = onBack, onOpenDrawer = onOpenDrawer) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = ShellPagePadding).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text("APPEARANCE", style = androidx.compose.material3.MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, letterSpacing = 0.36.sp), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            ShellCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Theme Mode")
                    SingleChoiceSegmentedButtonRow {
                        listOf("inherit" to "Auto", "light" to "Light", "dark" to "Dark").forEachIndexed { index, (value, label) ->
                            SegmentedButton(
                                selected = appearance == value,
                                onClick = { onAppearanceChange(value) },
                                label = { Text(label) },
                                shape = androidx.compose.material3.SegmentedButtonDefaults.itemShape(index = index, count = 3),
                            )
                        }
                    }
                }
            }
            Text("DATA", style = androidx.compose.material3.MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, letterSpacing = 0.36.sp), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            ShellCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    SettingsActionRow("Export", "↓", onExportData != null) { onExportData?.invoke() }
                    androidx.compose.material3.HorizontalDivider(color = androidx.compose.material3.MaterialTheme.colorScheme.outlineVariant)
                    SettingsActionRow("Import", "↑", onImportData != null) { confirmImport = true }
                    androidx.compose.material3.HorizontalDivider(color = androidx.compose.material3.MaterialTheme.colorScheme.outlineVariant)
                    SettingsActionRow("Reset App Data", "!", onResetAppData != null, destructive = true) { confirmReset = true }
                }
            }
            Text("TERMINAL", style = androidx.compose.material3.MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, letterSpacing = 0.36.sp), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            ShellCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Default Font Size: $defaultFontSize")
                    Slider(value = defaultFontSize.toFloat(), onValueChange = { onDefaultFontSizeChange(it.toInt().coerceIn(8, 40)) }, valueRange = 8f..40f, steps = 31)
                    NativeCompactField(defaultTerminalType, onDefaultTerminalTypeChange, "Default terminal type", fieldHeight = 44.dp)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Shortcut Bar")
                        Switch(checked = shortcutBar, onCheckedChange = onShortcutBarChange)
                    }
                }
            }
            Text("SECURITY", style = androidx.compose.material3.MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, letterSpacing = 0.36.sp), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            ShellCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (initialized) if (authenticated) "Encryption unlocked" else "Encryption locked" else "Encryption is not initialized", style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                    SettingsActionRow(
                        "App Lock",
                        when {
                            !initialized -> "Not configured"
                            authenticated -> "Unlocked"
                            else -> "Enabled"
                        },
                        enabled = false,
                    ) {}
                    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween) {
                        Text(if (cryptoEnabled) "Encrypted storage enabled" else "Encrypted storage disabled")
                        Switch(
                            checked = cryptoEnabled,
                            onCheckedChange = {
                            val data = JSONObject().put("cryptoEnable", it)
                            if (it) data.put("password", password).put("confirmPassword", confirm)
                            runtime.request("data.changeCryptoEnable", data) { response ->
                                if (response.has("error")) status = response.optJSONObject("error")?.optString("message") ?: "Unable to change encryption" else { status = "Encryption setting saved"; refresh() }
                            }
                            },
                            colors = androidx.compose.material3.SwitchDefaults.colors(
                                checkedThumbColor = androidx.compose.material3.MaterialTheme.colorScheme.onPrimary,
                                checkedTrackColor = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                                uncheckedThumbColor = androidx.compose.material3.MaterialTheme.colorScheme.outline,
                                uncheckedTrackColor = androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant,
                            ),
                        )
                    }
                    }
                    androidx.compose.material3.HorizontalDivider(color = androidx.compose.material3.MaterialTheme.colorScheme.outlineVariant)
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (initialized) {
                NativeCompactField(password, { password = it }, "Password", password = true, fieldHeight = 40.dp)
                if (authenticated) {
                    NativeCompactField(newPassword, { newPassword = it }, "New password", password = true, fieldHeight = 40.dp)
                    NativeCompactField(confirm, { confirm = it }, "Confirm password", password = true, fieldHeight = 40.dp)
                }
            } else {
                        NativeCompactField(newPassword, { newPassword = it }, "New password", password = true, fieldHeight = 40.dp)
                        NativeCompactField(confirm, { confirm = it }, "Confirm password", password = true, fieldHeight = 40.dp)
            }
            if (status.isNotBlank()) Text(status)
            OutlinedButton(onClick = {
                if (!initialized && (newPassword.isBlank() || newPassword != confirm)) {
                    status = "Passwords do not match"
                    return@OutlinedButton
                }
                val method = when {
                    !initialized -> "data.initCryptoPassword"
                    !authenticated -> "data.loadCryptoByPassword"
                    else -> "data.changeCryptoPassword"
                }
                val data = if (!initialized) JSONObject().put("password", newPassword).put("confirmPassword", confirm)
                else if (!authenticated) JSONObject().put("password", password)
                else JSONObject().put("oldPassword", password).put("password", newPassword).put("confirmPassword", confirm)
                runtime.request(method, data) { response ->
                    if (response.has("error")) status = response.optJSONObject("error")?.optString("message") ?: "Unable to save settings" else { status = "Saved"; password = ""; newPassword = ""; confirm = ""; refresh() }
                }
            }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(10.dp)) { Text(if (!initialized) "Initialize" else if (!authenticated) "Unlock" else "Change password") }
            OutlinedButton(onClick = {
                val method = if (initialized) "data.loadCryptoByBiometric" else "data.initCryptoBiometric"
                runtime.request(method) { response ->
                    if (response.has("error")) status = response.toString() else { status = "Biometric encryption ready"; refresh() }
                }
            }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(10.dp)) { Text(if (initialized) "Unlock with biometrics" else "Initialize biometrics") }
                    }
                }
            }
            Text("ABOUT", style = androidx.compose.material3.MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, letterSpacing = 0.36.sp), color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            ShellCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SettingsActionRow("Privacy Policy", "›", onOpenUrl != null) { onOpenUrl?.invoke("https://nashaofu.github.io/shell360/docs/Privacy-Policy.html") }
                    androidx.compose.material3.HorizontalDivider(color = androidx.compose.material3.MaterialTheme.colorScheme.outlineVariant)
                    SettingsActionRow("About", "›", onOpenUrl != null) { onOpenUrl?.invoke("https://nashaofu.github.io/shell360/") }
                    Text("Version $version", color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
    if (confirmImport) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmImport = false },
            title = { Text("Import configuration?") },
            text = { Text("Imported hosts, keys, and port forwarding rules will be added to the existing configuration.") },
            confirmButton = {
                Button(onClick = { confirmImport = false; onImportData?.invoke() }) { Text("Continue") }
            },
            dismissButton = { Button(onClick = { confirmImport = false }) { Text("Cancel") } },
        )
    }
    if (confirmReset) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text("Reset app data?") },
            text = { Text("This permanently deletes saved hosts, keys, port forwarding rules, known hosts, and encrypted settings from this device.") },
            confirmButton = {
                Button(onClick = { confirmReset = false; onResetAppData?.invoke() }) { Text("Reset") }
            },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { confirmReset = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SettingsActionRow(
    label: String,
    action: String,
    enabled: Boolean,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .padding(horizontal = 16.dp)
            .clickable(enabled = enabled, onClick = onClick),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = androidx.compose.material3.MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            color = when {
                !enabled -> androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant
                destructive -> androidx.compose.material3.MaterialTheme.colorScheme.error
                else -> androidx.compose.material3.MaterialTheme.colorScheme.onSurface
            },
        )
        Text(
            action,
            color = when {
                !enabled -> androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant
                destructive -> androidx.compose.material3.MaterialTheme.colorScheme.error
                else -> androidx.compose.material3.MaterialTheme.colorScheme.primary
            },
            style = androidx.compose.material3.MaterialTheme.typography.titleMedium,
        )
    }
}
