package com.nashaofu.shell360.feature.hosts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Numbers
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import com.nashaofu.shell360.core.data.AuthMethod
import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_FONT_FAMILY
import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_FONT_SIZE
import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_THEME
import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_TYPE
import com.nashaofu.shell360.core.data.HostModel
import com.nashaofu.shell360.core.data.HostTerminalSettings
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.core.data.TERMINAL_THEMES
import com.nashaofu.shell360.core.data.TERMINAL_TYPES
import com.nashaofu.shell360.core.data.newId
import com.nashaofu.shell360.core.data.parseEnvs
import com.nashaofu.shell360.core.data.stringifyEnvs
import com.nashaofu.shell360.core.data.validateEnvs
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppOutlinedButton
import com.nashaofu.shell360.ui.components.DrawerActions
import com.nashaofu.shell360.ui.components.FieldLabel
import com.nashaofu.shell360.ui.components.FormPasswordField
import com.nashaofu.shell360.ui.components.FormSegmentedField
import com.nashaofu.shell360.ui.components.FormSelectField
import com.nashaofu.shell360.ui.components.FormTextField
import com.nashaofu.shell360.ui.components.PageDrawer
import com.nashaofu.shell360.ui.components.SectionHeader
import com.nashaofu.shell360.ui.components.SelectOption
import com.nashaofu.shell360.ui.components.TagChipInput
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppType
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import com.nashaofu.shell360.ui.theme.AppSpacing

private const val ADD_KEY_VALUE = "__ADD_KEY__"

private data class HostDraft(
    val id: String,
    val name: String,
    val tags: List<String>,
    val hostname: String,
    val portText: String,
    val username: String,
    val authMethod: AuthMethod,
    val password: String,
    val keyId: String,
    val startupCommand: String,
    val terminalType: String,
    val envsText: String,
    val jumpHostEnabled: Boolean,
    val jumpHostIds: List<String>,
    val fontFamily: String,
    val fontSizeText: String,
    val theme: String,
) {
    companion object {
        fun from(host: HostModel?): HostDraft = HostDraft(
            id = host?.id ?: newId(),
            name = host?.name.orEmpty(),
            tags = host?.tags.orEmpty(),
            hostname = host?.hostname.orEmpty(),
            portText = (host?.port ?: 22).toString(),
            username = host?.username.orEmpty(),
            authMethod = host?.authenticationMethod ?: AuthMethod.Password,
            password = host?.password.orEmpty(),
            keyId = host?.keyId.orEmpty(),
            startupCommand = host?.startupCommand.orEmpty(),
            terminalType = host?.terminalType ?: DEFAULT_TERMINAL_TYPE,
            envsText = stringifyEnvs(host?.envs.orEmpty()),
            jumpHostEnabled = !host?.jumpHostIds.isNullOrEmpty(),
            jumpHostIds = host?.jumpHostIds.orEmpty(),
            fontFamily = host?.terminalSettings?.fontFamily ?: DEFAULT_TERMINAL_FONT_FAMILY,
            fontSizeText = (host?.terminalSettings?.fontSize ?: DEFAULT_TERMINAL_FONT_SIZE).toString(),
            theme = host?.terminalSettings?.theme ?: DEFAULT_TERMINAL_THEME,
        )
    }

    fun toModel(): HostModel = HostModel(
        id = id,
        name = name.trim(),
        tags = tags,
        hostname = hostname.trim(),
        port = portText.toIntOrNull() ?: 22,
        username = username.trim(),
        authenticationMethod = authMethod,
        password = if (authMethod == AuthMethod.Password) password else "",
        keyId = if (authMethod == AuthMethod.PublicKey || authMethod == AuthMethod.Certificate) keyId else "",
        startupCommand = startupCommand,
        terminalType = terminalType.ifBlank { DEFAULT_TERMINAL_TYPE },
        envs = parseEnvs(envsText),
        jumpHostIds = if (jumpHostEnabled) jumpHostIds else emptyList(),
        terminalSettings = HostTerminalSettings(
            fontFamily = fontFamily.ifBlank { DEFAULT_TERMINAL_FONT_FAMILY },
            fontSize = fontSizeText.toIntOrNull() ?: DEFAULT_TERMINAL_FONT_SIZE,
            theme = theme.ifBlank { DEFAULT_TERMINAL_THEME },
        ),
    )
}

private data class HostFormErrors(
    val name: String? = null,
    val hostname: String? = null,
    val port: String? = null,
    val username: String? = null,
    val password: String? = null,
    val keyId: String? = null,
    val startupCommand: String? = null,
    val envs: String? = null,
    val fontFamily: String? = null,
    val fontSize: String? = null,
) {
    val hasError: Boolean
        get() = listOf(
            name,
            hostname,
            port,
            username,
            password,
            keyId,
            startupCommand,
            envs,
            fontFamily,
            fontSize,
        ).any { it != null }
}

private fun validate(draft: HostDraft): HostFormErrors {
    val port = draft.portText.toIntOrNull()
    val fontSize = draft.fontSizeText.toIntOrNull()
    return HostFormErrors(
        name = if (draft.name.length > 60) "Please enter no more than 60 characters" else null,
        hostname = when {
            draft.hostname.isBlank() -> "Please enter hostname"
            draft.hostname.length < 3 -> "Please enter at least 3 characters"
            draft.hostname.length > 60 -> "Please enter no more than 60 characters"
            else -> null
        },
        port = when {
            draft.portText.isBlank() -> "Please enter port"
            port == null -> "Please enter the number"
            port < 1 -> "The port cannot be less than 1"
            port > 65535 -> "The port cannot be greater than 65535"
            else -> null
        },
        username = when {
            draft.username.isBlank() -> "Please enter username"
            draft.username.length > 60 -> "Please enter no more than 60 characters"
            else -> null
        },
        password = if (draft.password.length > 100) "Please enter no more than 100 characters" else null,
        keyId = if (
            (draft.authMethod == AuthMethod.PublicKey || draft.authMethod == AuthMethod.Certificate) &&
            draft.keyId.isBlank()
        ) {
            "Please select key"
        } else {
            null
        },
        startupCommand = if (draft.startupCommand.length > 500) "Please enter no more than 500 characters" else null,
        envs = validateEnvs(draft.envsText),
        fontFamily = if (draft.fontFamily.isBlank()) "Please enter font family" else null,
        fontSize = when {
            draft.fontSizeText.isBlank() -> "Please enter font size"
            fontSize == null -> "Please enter the number"
            fontSize < 1 -> "The font size cannot be less than 1"
            else -> null
        },
    )
}

@Composable
fun HostEditorDrawer(
    open: Boolean,
    data: HostModel?,
    onCancel: () -> Unit,
    onSaved: (HostModel, Boolean) -> Unit,
    onOpenAddKey: () -> Unit,
    fullscreen: Boolean = false,
) {
    var draft by remember(open, data) { mutableStateOf(HostDraft.from(data)) }
    var submitted by remember(open, data) { mutableStateOf(false) }
    var saveMenuOpen by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    val errors = if (submitted) validate(draft) else HostFormErrors()
    val hosts = Shell360Store.hosts
    val tagSuggestions = hosts.flatMap { it.tags }.distinct()

    val keyOptions = buildList {
        add(SelectOption(ADD_KEY_VALUE, "+ Add key"))
        Shell360Store.keys.forEach { add(SelectOption(it.id, it.name.ifBlank { it.id })) }
    }

    fun submit(connect: Boolean) {
        submitted = true
        if (validate(draft).hasError) return
        val model = draft.toModel()
        coroutineScope.launch {
            runCatching { AndroidRuntime.saveHost(model) }
                .onSuccess { saved ->
                    Shell360Store.saveHost(saved)
                    onSaved(saved, connect)
                }
                .onFailure { Toast.makeText(context, it.message ?: "Could not save host", Toast.LENGTH_LONG).show() }
        }
    }

    PageDrawer(
        open = open,
        title = if (data == null) "Add host" else "Edit host",
        onCancel = onCancel,
        footer = {
            DrawerActions {
                AppOutlinedButton(onClick = onCancel) { Text("Cancel", style = AppType.buttonLabel) }
                Row(Modifier.weight(1f)) {
                    AppButton(
                        onClick = { submit(false) },
                        modifier = Modifier.weight(1f),
                    ) { Text("Save", style = AppType.buttonLabel) }
                    Box {
                        AppButton(onClick = { saveMenuOpen = true }) {
                            Icon(
                                Icons.Filled.ArrowDropDown,
                                contentDescription = "More save actions",
                                modifier = Modifier.size(AppSizes.buttonIcon),
                            )
                        }
                        DropdownMenu(
                            expanded = saveMenuOpen,
                            onDismissRequest = { saveMenuOpen = false },
                        ) {
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = "Save & Connect",
                                        style = AppType.body,
                                        color = AppTheme.colors.textPrimary,
                                    )
                                },
                                onClick = {
                                    saveMenuOpen = false
                                    submit(true)
                                },
                            )
                        }
                    }
                }
            }
        },
        fullscreen = fullscreen,
    ) {
        Text("Basic information", style = MaterialTheme.typography.titleMedium)

        FormTextField(
            label = "Name",
            value = draft.name,
            onValueChange = { draft = draft.copy(name = it) },
            placeholder = "Name",
            error = errors.name,
        )

        TagChipInput(
            values = draft.tags,
            onValuesChange = { draft = draft.copy(tags = it) },
            suggestions = tagSuggestions,
        )

        FormTextField(
            label = "Hostname",
            value = draft.hostname,
            onValueChange = { draft = draft.copy(hostname = it) },
            placeholder = "Hostname",
            error = errors.hostname,
            leadingIcon = Icons.Filled.Language,
        )

        FormTextField(
            label = "Port",
            value = draft.portText,
            onValueChange = { value -> draft = draft.copy(portText = value.filter { it.isDigit() }) },
            placeholder = "Port",
            error = errors.port,
            keyboardType = KeyboardType.Number,
            leadingIcon = Icons.Filled.Numbers,
        )

        FormTextField(
            label = "Username",
            value = draft.username,
            onValueChange = { draft = draft.copy(username = it) },
            placeholder = "Username",
            error = errors.username,
            leadingIcon = Icons.Filled.Person,
        )

        FormSelectField(
            label = "Authentication method",
            value = draft.authMethod.name,
            options = AuthMethod.entries.map { SelectOption(it.name, it.label) },
            onValueChange = { value -> draft = draft.copy(authMethod = AuthMethod.valueOf(value)) },
        )

        if (draft.authMethod == AuthMethod.Password) {
            FormPasswordField(
                label = "Password",
                value = draft.password,
                onValueChange = { draft = draft.copy(password = it) },
                placeholder = "Password",
                error = errors.password,
            )
        }

        if (draft.authMethod == AuthMethod.PublicKey || draft.authMethod == AuthMethod.Certificate) {
            FormSelectField(
                label = "Key",
                value = draft.keyId,
                options = keyOptions,
                onValueChange = { value ->
                    if (value == ADD_KEY_VALUE) onOpenAddKey() else draft = draft.copy(keyId = value)
                },
                placeholder = "Key",
                error = errors.keyId,
            )
        }

        FormTextField(
            label = "Startup Command",
            value = draft.startupCommand,
            onValueChange = { draft = draft.copy(startupCommand = it) },
            placeholder = "Command to execute after connection (optional)",
            error = errors.startupCommand,
            leadingIcon = Icons.Filled.Code,
        )

        FormSelectField(
            label = "Terminal type",
            value = draft.terminalType,
            options = TERMINAL_TYPES.map { SelectOption(it, it) },
            onValueChange = { draft = draft.copy(terminalType = it) },
            placeholder = "Terminal type",
        )

        FormTextField(
            label = "Environment variables",
            value = draft.envsText,
            onValueChange = { draft = draft.copy(envsText = it) },
            placeholder = "e.g. KEY1=VALUE1,KEY2=VALUE2",
            error = errors.envs,
            leadingIcon = Icons.Filled.Tune,
        )

        SectionHeader("Jump Hosts")
        FormSegmentedField(
            label = "Jump hosts",
            options = listOf(
                SelectOption("false", "Disabled"),
                SelectOption("true", "Enabled"),
            ),
            value = if (draft.jumpHostEnabled) "true" else "false",
            onValueChange = { value -> draft = draft.copy(jumpHostEnabled = value == "true") },
        )
        if (draft.jumpHostEnabled) {
            JumpHostIdsField(
                hostId = draft.id,
                selected = draft.jumpHostIds,
                onSelectedChange = { draft = draft.copy(jumpHostIds = it) },
            )
        }

        SectionHeader("Terminal Settings")
        FormTextField(
            label = "Font family",
            value = draft.fontFamily,
            onValueChange = { draft = draft.copy(fontFamily = it) },
            placeholder = "Font family",
            error = errors.fontFamily,
        )
        FormTextField(
            label = "Font size",
            value = draft.fontSizeText,
            onValueChange = { value -> draft = draft.copy(fontSizeText = value.filter { it.isDigit() }) },
            placeholder = "Font size",
            error = errors.fontSize,
            keyboardType = KeyboardType.Number,
        )
        FormSelectField(
            label = "Theme",
            value = draft.theme,
            options = TERMINAL_THEMES.map { SelectOption(it, it) },
            onValueChange = { draft = draft.copy(theme = it) },
            placeholder = "Theme",
        )
    }
}

@Composable
private fun JumpHostIdsField(
    hostId: String,
    selected: List<String>,
    onSelectedChange: (List<String>) -> Unit,
) {
    val candidates = Shell360Store.hosts.filter { it.id != hostId }
    var expanded by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth()) {
        FieldLabel("Jump host chain")
        Box(Modifier.padding(top = AppSpacing.sm)) {
            AppOutlinedButton(
                onClick = { expanded = true },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = if (selected.isEmpty()) {
                        "Select jump hosts"
                    } else {
                        "${selected.size} host(s) selected"
                    },
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Start,
                )
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                if (candidates.isEmpty()) {
                    DropdownMenuItem(
                        text = { Text("No other hosts available") },
                        onClick = { expanded = false },
                    )
                }
                candidates.forEach { host ->
                    val isSelected = selected.contains(host.id)
                    DropdownMenuItem(
                        text = { Text(host.title) },
                        onClick = {
                            onSelectedChange(if (isSelected) selected - host.id else selected + host.id)
                        },
                        trailingIcon = if (isSelected) {
                            { Icon(Icons.Filled.Check, contentDescription = null) }
                        } else {
                            null
                        },
                    )
                }
            }
        }
        if (selected.isNotEmpty()) {
            Row(
                Modifier.padding(top = AppSpacing.sm),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                selected.forEachIndexed { index, id ->
                    val host = Shell360Store.hostById(id)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(AppSpacing.sm))
                            .background(AppTheme.colors.accentSoft)
                            .clickable { onSelectedChange(selected - id) }
                            .padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm),
                    ) {
                        Text("${index + 1}. ${host?.title ?: id}", color = AppTheme.colors.accent)
                    }
                }
            }
        }
    }
}
