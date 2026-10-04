package com.nashaofu.shell360.feature.settings

import android.content.Context
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.net.toUri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import com.nashaofu.shell360.core.data.AppDataJson
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import kotlinx.coroutines.launch
import com.nashaofu.shell360.ui.components.AppCard
import com.nashaofu.shell360.ui.components.AppGroupLabel
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppTopBar
import com.nashaofu.shell360.ui.components.AppPageContent
import com.nashaofu.shell360.ui.components.FeedbackEffect
import com.nashaofu.shell360.ui.components.SegmentedControl
import com.nashaofu.shell360.ui.components.SelectOption
import com.nashaofu.shell360.ui.components.SwitchRow
import com.nashaofu.shell360.ui.components.rememberFeedbackHost
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.ThemeMode

private const val PRIVACY_POLICY_URL = "https://nashaofu.github.io/shell360/docs/Privacy-Policy.html"
private const val ABOUT_URL = "https://nashaofu.github.io/shell360/"

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun SettingsScreen(
    viewModel: SettingsViewModel = remember { SettingsViewModel() },
    onOpenNavigation: () -> Unit = {},
) {
    val state = viewModel.uiState
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = rememberFeedbackHost()
    var importConfirmOpen by remember { mutableStateOf(false) }

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        viewModel.onAction(SettingsAction.FeedbackDismissed)
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val result = runCatching {
            context.contentResolver.openOutputStream(uri)?.use { stream ->
                stream.write(AppDataJson.export().toByteArray())
            } ?: error("The selected file could not be opened")
        }
        viewModel.onAction(
            SettingsAction.Feedback(
                result.fold(
                    onSuccess = { "Export file successful" },
                    onFailure = { "Export failed: ${it.message}" },
                ),
            ),
        )
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        coroutineScope.launch {
            val oldHosts = Shell360Store.hosts.toList()
            val oldKeys = Shell360Store.keys.toList()
            val oldTunnels = Shell360Store.tunnels.toList()
            val original = AppDataJson.export()
            val result = runCatching {
                val text = context.contentResolver.openInputStream(uri)
                    ?.bufferedReader()
                    ?.use { it.readText() }
                    ?: error("The selected file could not be read")
                val imported = AppDataJson.importToModels(text)
                Shell360Store.hosts.clear(); Shell360Store.hosts.addAll(imported.hosts)
                Shell360Store.keys.clear(); Shell360Store.keys.addAll(imported.keys)
                Shell360Store.knownHosts.clear(); Shell360Store.knownHosts.addAll(imported.knownHosts)
                Shell360Store.tunnels.clear(); Shell360Store.tunnels.addAll(imported.tunnels)
                AndroidRuntime.replaceImportedData(oldHosts, oldKeys, oldTunnels)
            }
            if (result.isFailure) AppDataJson.import(original)
            viewModel.onAction(
                SettingsAction.Feedback(
                    result.fold(
                        onSuccess = { "Import file successful" },
                        onFailure = { "Import failed: ${it.message}" },
                    ),
                ),
            )
        }
    }

    Scaffold(
        topBar = { AppTopBar(title = "Settings", onOpenNavigation = onOpenNavigation) },
        snackbarHost = { AppSnackbarHost(snackbarHostState) },
        containerColor = AppTheme.colors.bgPage,
    ) { padding ->
        AppPageContent(
            modifier = Modifier.padding(padding),
            contentModifier = Modifier.verticalScroll(rememberScrollState()),
        ) {
            SettingsSection("Appearance") {
                SettingsGroup {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Theme Mode",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.weight(1f),
                        )
                        SegmentedControl(
                            options = ThemeMode.entries.map { SelectOption(it.name, it.label) },
                            value = state.themeMode.name,
                            onValueChange = { value ->
                                viewModel.onAction(SettingsAction.ThemeSelected(ThemeMode.valueOf(value)))
                            },
                            modifier = Modifier.width(AppSizes.settingsModeControlWidth),
                        )
                    }
                }
            }

            SettingsSection("Data") {
                SettingsGroup {
                    SettingsRow(
                        label = "Export",
                        icon = Icons.Filled.FileDownload,
                        onClick = { exportLauncher.launch("shell360.json") },
                    )
                    HorizontalDivider(color = AppTheme.colors.accentBorder.copy(alpha = 0.5f))
                    SettingsRow(
                        label = "Import",
                        icon = Icons.Filled.FileUpload,
                        onClick = { importConfirmOpen = true },
                    )
                }
            }

            SettingsSection("Security") {
                SettingsGroup {
                    SwitchRow(
                        label = "Crypto Enable",
                        checked = state.cryptoEnabled,
                        onCheckedChange = {
                            viewModel.onAction(SettingsAction.CryptoEnableChanged(it))
                        },
                        modifier = Modifier.padding(horizontal = AppSpacing.lg, vertical = AppSpacing.xs),
                    )
                    if (state.cryptoEnabled) {
                        HorizontalDivider(color = AppTheme.colors.accentBorder.copy(alpha = 0.5f))
                        SettingsRow(
                            label = "Change Crypto Password",
                            icon = Icons.AutoMirrored.Filled.ArrowForward,
                            onClick = { viewModel.openChangePassword() },
                        )
                    }
                }
            }

            SettingsSection("About") {
                SettingsGroup {
                    SettingsRow(
                        label = "Privacy Policy",
                        icon = Icons.AutoMirrored.Filled.ArrowForward,
                        onClick = { openUrl(context, PRIVACY_POLICY_URL) },
                    )
                    HorizontalDivider(color = AppTheme.colors.accentBorder.copy(alpha = 0.5f))
                    SettingsRow(
                        label = "About",
                        icon = Icons.AutoMirrored.Filled.ArrowForward,
                        onClick = { openUrl(context, ABOUT_URL) },
                    )
                    HorizontalDivider(color = AppTheme.colors.accentBorder.copy(alpha = 0.5f))
                    SettingsRow(label = "Version", rightText = Shell360Store.version)
                }
            }

            Spacer(Modifier.height(AppSpacing.xl))
        }
    }

    if (importConfirmOpen) {
        AppDialog(
            open = true,
            title = "Import configuration?",
            message = "Imported hosts, keys, and tunnels will be added to the existing configuration.",
            onDismiss = { importConfirmOpen = false },
            actions = {
                AppTextButton(
                    onClick = {
                        importConfirmOpen = false
                        importLauncher.launch(arrayOf("application/json"))
                    },
                ) { Text("Continue") }
                AppTextButton(onClick = { importConfirmOpen = false }) { Text("Cancel") }
            },
        )
    }

    InitCryptoDialog(
        open = state.isInitCryptoOpen,
        onCancel = { viewModel.onAction(SettingsAction.InitCryptoDismissed) },
        onSubmit = { viewModel.onAction(SettingsAction.InitCryptoSubmitted(it)) },
    )

    ChangeCryptoPasswordDialog(
        open = state.isChangePasswordOpen,
        onCancel = { viewModel.onAction(SettingsAction.ChangePasswordDismissed) },
        onSubmit = { oldPassword, newPassword ->
            viewModel.onAction(SettingsAction.ChangePasswordSubmitted(oldPassword, newPassword))
        },
    )
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(Modifier.padding(top = AppSpacing.xl)) {
        AppGroupLabel(title, Modifier.padding(bottom = AppSpacing.sm))
        content()
    }
}

@Composable
private fun SettingsGroup(content: @Composable () -> Unit) {
    AppCard { content() }
}

@Composable
private fun SettingsRow(
    label: String,
    icon: ImageVector? = null,
    rightText: String? = null,
    disabled: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = AppSizes.sidebarItem)
            .padding(horizontal = AppSpacing.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = AppType.bodyStrong,
            color = if (disabled) AppTheme.colors.textMuted else AppTheme.colors.textPrimary,
        )
        if (disabled) {
            Text(
                text = " (Unavailable)",
                style = AppType.badge,
                color = AppTheme.colors.textMuted,
            )
        }
        Spacer(Modifier.weight(1f))
        if (rightText != null) {
            Text(
                text = rightText,
                style = AppType.body,
                color = AppTheme.colors.textMuted,
                maxLines = 1,
            )
        }
        if (icon != null) {
            IconButton(
                onClick = { onClick?.invoke() },
                enabled = !disabled,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = AppTheme.colors.textMuted,
                )
            }
        }
    }
}

private fun openUrl(context: Context, url: String) {
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
    }
}
