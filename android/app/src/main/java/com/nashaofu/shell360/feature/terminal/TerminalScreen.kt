package com.nashaofu.shell360.feature.terminal

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import kotlinx.coroutines.delay
import com.nashaofu.shell360.core.data.HostModel
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.data.HostTerminalSettings
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.AuthMethod
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme

@Composable
fun TerminalScreen(
    session: SessionModel,
    host: HostModel?,
    onClose: () -> Unit,
    onOpenAddKey: () -> Unit,
    onRetryConnection: (String?, AuthMethod, String, String) -> Unit = { _, _, _, _ -> },
    onSendInput: (String) -> Unit = {},
    viewModel: TerminalViewModel = remember { TerminalViewModel() },
) {
    LaunchedEffect(session.id, session.status, host?.id) {
        if (session.status == com.nashaofu.shell360.core.data.SessionStatus.Pending && host != null) {
            AndroidRuntime.connectSession(session, host)
        }
    }
    LaunchedEffect(session.status, session.error) {
        viewModel.syncSession(session)
        host?.let {
            viewModel.onAction(TerminalAction.AuthMethodChanged(it.authenticationMethod))
            viewModel.onAction(TerminalAction.AuthPasswordChanged(it.password))
            viewModel.onAction(TerminalAction.AuthKeyChanged(it.keyId))
        }
    }
    LaunchedEffect(session.id, session.status) {
        if (session.status == com.nashaofu.shell360.core.data.SessionStatus.Pending) {
            delay(15_000)
            if (session.status == com.nashaofu.shell360.core.data.SessionStatus.Pending) {
                viewModel.onAction(TerminalAction.ConnectionTimedOut)
            }
        }
    }

    val state = viewModel.uiState
    var input by remember(session.id) { mutableStateOf("") }
    val outputScroll = rememberScrollState()
    val settings = host?.terminalSettings ?: HostTerminalSettings()
    var terminalSize by remember(session.id) { mutableStateOf(IntSize.Zero) }
    val density = LocalDensity.current
    LaunchedEffect(session.sshShellId, terminalSize, settings.fontSize) {
        if (terminalSize.width > 0 && terminalSize.height > 0) {
            val charWidthPx = with(density) { settings.fontSize.dp.toPx() * 0.62f }
            val lineHeightPx = with(density) { settings.fontSize.dp.toPx() * 1.35f }
            AndroidRuntime.resizeTerminal(
                session,
                (terminalSize.width / charWidthPx).toInt().coerceAtLeast(1),
                (terminalSize.height / lineHeightPx).toInt().coerceAtLeast(1),
                with(density) { terminalSize.width.toDp().value.toInt() },
                with(density) { terminalSize.height.toDp().value.toInt() },
            )
        }
    }
    LaunchedEffect(session.terminalOutput) { outputScroll.scrollTo(outputScroll.maxValue) }
    val theme = terminalThemeByName(settings.theme)
    val colors = AppTheme.colors
    val failed = state.status == TerminalStatus.Error
    val masked = state.status != TerminalStatus.Connected
    val hostTitle = host?.title ?: session.name
    val command = "ssh ${host?.username.orEmpty()}@${host?.hostname.orEmpty()} -p ${host?.port ?: 0}"
    // Mirrors the SSHLoading dispatch: error.type wins, otherwise the transport code.
    val errorKind = terminalErrorKind(type = state.errorType, code = state.errorCode)
    val errorPresentation = if (failed) {
        terminalErrorPresentation(
            kind = errorKind,
            message = state.errorMessage,
        )
    } else {
        null
    }
    val authForm: (@Composable () -> Unit)? = when {
        !failed -> null
        errorKind == TerminalErrorKind.Authentication -> {
            {
                TerminalAuthForm(
                    method = state.authMethod,
                    password = state.authPassword,
                    keyId = state.authKeyId,
                    keys = Shell360Store.keys,
                    onMethodChange = { viewModel.onAction(TerminalAction.AuthMethodChanged(it)) },
                    onPasswordChange = { viewModel.onAction(TerminalAction.AuthPasswordChanged(it)) },
                    onKeyChange = { viewModel.onAction(TerminalAction.AuthKeyChanged(it)) },
                    onOpenAddKey = onOpenAddKey,
                )
            }
        }

        errorKind == TerminalErrorKind.KeyboardInteractive -> {
            {
                KeyboardInteractiveForm(
                    answer = state.keyboardAnswer,
                    onAnswerChange = { viewModel.onAction(TerminalAction.KeyboardAnswerChanged(it)) },
                )
            }
        }

        else -> null
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(theme.background)
                .onSizeChanged { terminalSize = it },
        ) {
            // The VT grid renders from the content origin with no padding, matching the
            // reference: `.xterm-scrollable-element` padding only insets the scrollbar.
            if (masked) {
                SshLoadingMask(
                    hostTitle = hostTitle,
                    command = command,
                    error = errorPresentation,
                    onClose = onClose,
                    onPrimaryAction = {
                        viewModel.onAction(TerminalAction.Retry)
                        onRetryConnection(null, state.authMethod, state.authPassword, state.authKeyId)
                    },
                    onPrimaryMenuAction = {
                        viewModel.onAction(TerminalAction.Retry)
                        onRetryConnection(if (errorKind == TerminalErrorKind.UnknownServerKey) "AddAndContinue" else null, state.authMethod, state.authPassword, state.authKeyId)
                    },
                    modifier = Modifier.fillMaxSize(),
                    formContent = authForm,
                )
            } else {
                Column(Modifier.fillMaxSize().padding(AppSpacing.md)) {
                    Text(
                        text = session.terminalOutput,
                        modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(outputScroll),
                        color = theme.foreground,
                        fontFamily = FontFamily.Monospace,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = input,
                            onValueChange = { input = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            placeholder = { Text("Enter terminal input") },
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send, keyboardType = KeyboardType.Text),
                            keyboardActions = KeyboardActions(onSend = {
                                if (input.isNotEmpty()) onSendInput(input)
                                onSendInput("\r")
                                input = ""
                            }),
                        )
                        IconButton(onClick = {
                            if (input.isNotEmpty()) onSendInput(input)
                            onSendInput("\r")
                            input = ""
                        }) { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send terminal input") }
                    }
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.bgSubtle),
        ) {
            HorizontalDivider(thickness = 1.dp, color = colors.borderStrong)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppSpacing.sm, vertical = AppSpacing.xs),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                KeyboardToggle(
                    active = state.virtualKeyboardVisible,
                    onClick = { viewModel.onAction(TerminalAction.ToggleKeyboard) },
                )
            }
            if (state.virtualKeyboardVisible) {
                VirtualKeyboard(
                    onInput = {
                        viewModel.onAction(TerminalAction.VirtualKey(it))
                        onSendInput(it)
                    },
                    applicationCursorKeys = state.applicationCursorKeysMode,
                    modifier = Modifier.padding(bottom = AppSpacing.xs),
                )
            }
        }
    }
}

/** Mirrors `.keyboardToggle`: 38×26, radius 4, 1px border, accent tint when active. */
@Composable
private fun KeyboardToggle(active: Boolean, onClick: () -> Unit) {
    val colors = AppTheme.colors

    Box(
        modifier = Modifier
            .width(AppSizes.keyboardToggleWidth)
            .height(AppSizes.keyboardToggleHeight)
            .clip(MaterialTheme.shapes.extraSmall)
            .background(if (active) colors.accent.copy(alpha = 0.12f) else colors.bgSurface)
            .border(
                width = 1.dp,
                color = if (active) colors.accent else colors.borderStrong,
                shape = MaterialTheme.shapes.extraSmall,
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Keyboard,
            contentDescription = if (active) "Hide virtual keyboard" else "Show virtual keyboard",
            tint = if (active) colors.accent else colors.textPrimary,
            modifier = Modifier.size(AppSizes.inlineIcon),
        )
    }
}

private fun terminalBackground(theme: String): Long = when (theme) {
    "Nord Light" -> 0xFFE5E9F0
    "Solarized Light" -> 0xFFFDF6E3
    "Tango Light" -> 0xFFFFFFFF
    "Solarized Dark" -> 0xFF002B36
    "Tango Dark" -> 0xFF000000
    else -> 0xFF2E3440
}

private fun terminalForeground(theme: String): Long = when (theme) {
    "Nord Light" -> 0xFF414858
    "Solarized Light" -> 0xFF657B83
    "Tango Light" -> 0xFF000000
    "Solarized Dark" -> 0xFF839496
    "Tango Dark" -> 0xFFFFFFFF
    else -> 0xFFD8DEE9
}
