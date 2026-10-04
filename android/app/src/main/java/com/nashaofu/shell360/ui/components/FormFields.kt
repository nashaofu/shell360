package com.nashaofu.shell360.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType


data class SelectOption(val value: String, val label: String)

@Composable
fun FieldLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = AppType.sectionLabel,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

@Composable
fun AppFieldContainer(
    modifier: Modifier = Modifier,
    error: Boolean = false,
    focused: Boolean = false,
    enabled: Boolean = true,
    onClick: (() -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = AppTheme.colors
    val shape = MaterialTheme.shapes.medium
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = AppSizes.fieldHeight)
            .clip(shape)
            .background(if (enabled) colors.bgSurface else colors.bgSubtle)
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = when {
                    error -> colors.errorBorder
                    focused -> colors.accent
                    else -> colors.borderSubtle
                },
                shape = shape,
            )
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick) else Modifier)
            .padding(horizontal = AppSpacing.md, vertical = AppSpacing.xs),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
fun FieldError(message: String?, modifier: Modifier = Modifier) {
    if (message.isNullOrEmpty()) return
    Text(
        text = message,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.error,
        modifier = modifier.padding(top = AppSpacing.xs),
    )
}

@Composable
fun FieldHint(message: String, modifier: Modifier = Modifier) {
    Text(
        text = message,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(top = AppSpacing.xs),
    )
}

/** External-label wrapper for controls that have no built-in label (chips, segmented). */
@Composable
fun FormField(
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    headerTrailing: @Composable (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FieldLabel(label, Modifier.weight(1f))
            headerTrailing?.invoke()
        }
        Spacer(Modifier.height(AppSpacing.sm))
        content()
        FieldError(error)
    }
}

@Composable
fun FormTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    error: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text,
    keyboardOptions: KeyboardOptions = KeyboardOptions(keyboardType = keyboardType),
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    enabled: Boolean = true,
    leadingIcon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    trailing: @Composable (() -> Unit)? = null,
    headerTrailing: @Composable (() -> Unit)? = null,
) {
    Column(modifier.fillMaxWidth()) {
        if (headerTrailing != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = AppSpacing.xs),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                headerTrailing()
            }
        }
        ShellTextField(label, value, onValueChange, placeholder, error, singleLine, minLines, keyboardType, enabled, leadingIcon, trailing, keyboardOptions, keyboardActions)
    }
}

@Composable
fun FormPasswordField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    error: String? = null,
    enabled: Boolean = true,
) {
    var visible by remember { mutableStateOf(false) }
    ShellTextField(
        label = label,
        value = value,
        onValueChange = onValueChange,
        placeholder = placeholder,
        validationMessage = error,
        singleLine = true,
        minLines = 1,
        keyboardType = KeyboardType.Password,
        enabled = enabled,
        leadingIcon = null,
        trailing = {
            AppIconButton(
                icon = if (visible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                contentDescription = if (visible) "Hide password" else "Show password",
                onClick = { visible = !visible },
            )
        },
        passwordVisible = visible,
    )
}

@Composable
private fun ShellTextField(label: String, value: String, onValueChange: (String) -> Unit, placeholder: String, validationMessage: String?, singleLine: Boolean, minLines: Int, keyboardType: KeyboardType, enabled: Boolean, leadingIcon: androidx.compose.ui.graphics.vector.ImageVector?, trailing: (@Composable () -> Unit)? = null, keyboardOptions: KeyboardOptions = KeyboardOptions(keyboardType = keyboardType), keyboardActions: KeyboardActions = KeyboardActions.Default, passwordVisible: Boolean = false) {
    Text(label, style = AppType.sectionLabel, color = AppTheme.colors.textSecondary)
    Spacer(Modifier.height(AppSpacing.xs))
    val hasError = !validationMessage.isNullOrEmpty()
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    BasicTextField(value, onValueChange, modifier = Modifier.fillMaxWidth(), enabled = enabled, singleLine = singleLine, minLines = minLines, keyboardOptions = keyboardOptions, keyboardActions = keyboardActions, interactionSource = interaction, textStyle = AppType.body.copy(color = AppTheme.colors.textPrimary), cursorBrush = androidx.compose.ui.graphics.SolidColor(AppTheme.colors.accent), visualTransformation = if (keyboardType == KeyboardType.Password && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None, decorationBox = { inner ->
        AppFieldContainer(error = hasError, focused = focused) {
            if (leadingIcon != null) Icon(leadingIcon, null, tint = AppTheme.colors.textSecondary, modifier = Modifier.padding(end = AppSpacing.sm))
            Box(Modifier.weight(1f)) { if (value.isEmpty() && placeholder.isNotEmpty()) Text(placeholder, style = AppType.body, color = AppTheme.colors.textMuted); inner() }
            trailing?.invoke()
        }
    })
    FieldError(validationMessage)
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun FormSelectField(
    label: String,
    value: String,
    options: List<SelectOption>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Select",
    error: String? = null,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }
    val selected = options.firstOrNull { it.value == value }

    FormField(label, modifier, error) {
        Box {
            AppFieldContainer(enabled = enabled, error = !error.isNullOrEmpty(), onClick = { expanded = true }) {
                Text(
                    text = selected?.label ?: placeholder,
                    modifier = Modifier.weight(1f),
                    style = AppType.body,
                    color = if (selected == null) AppTheme.colors.textMuted else AppTheme.colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Icon(
                    imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = null,
                    tint = AppTheme.colors.textSecondary,
                )
            }
            DropdownMenu(
                expanded = expanded && enabled,
                onDismissRequest = { expanded = false },
                shape = RoundedCornerShape(AppSpacing.md),
                containerColor = AppTheme.colors.bgSurface,
                tonalElevation = 0.dp,
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.label, style = AppType.body, color = AppTheme.colors.textPrimary) },
                        onClick = {
                            expanded = false
                            onValueChange(option.value)
                        },
                    )
                }
            }
        }
    }
}

@Composable
fun SegmentedControl(
    options: List<SelectOption>,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    SingleChoiceSegmentedButtonRow(modifier = modifier.fillMaxWidth()) {
        options.forEachIndexed { index, option ->
            SegmentedButton(
                selected = option.value == value,
                onClick = { onValueChange(option.value) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
            ) {
                Text(option.label, style = AppType.buttonLabel)
            }
        }
    }
}

@Composable
fun FormSegmentedField(
    label: String,
    options: List<SelectOption>,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null,
) {
    FormField(label, modifier, error) {
        SegmentedControl(options, value, onValueChange)
    }
}

@Composable
fun SwitchRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    enabled: Boolean = true,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = AppSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.md),
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
            )
            if (supporting != null) {
                Text(
                    text = supporting,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = AppSpacing.xs),
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TagChipInput(
    values: List<String>,
    onValuesChange: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
    suggestions: List<String> = emptyList(),
    label: String = "Tags",
    placeholder: String = "Type tag and press Enter",
    error: String? = null,
) {
    var input by remember { mutableStateOf("") }

    fun commit(raw: String) {
        val next = raw.removeSuffix(",").trim()
        if (next.isNotEmpty() && !values.contains(next)) {
            onValuesChange(values + next)
        }
        input = ""
    }

    Column(modifier.fillMaxWidth()) {
            FormTextField(
                label = label,
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = placeholder,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { commit(input) }),
                trailing = { AppIconButton(Icons.Filled.Add, "Add tag", onClick = { commit(input) }) },
            )

            if (values.isNotEmpty()) {
                FlowRow(
                    modifier = Modifier.padding(top = AppSpacing.sm),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                ) {
                    values.forEach { tag ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(AppSpacing.sm))
                                .background(AppTheme.colors.bgSurface)
                                .border(1.dp, AppTheme.colors.accentBorder, RoundedCornerShape(AppSpacing.sm))
                                .clickable(role = Role.Button) { onValuesChange(values - tag) }
                                .padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm),
                        ) {
                            Text(tag, style = AppType.caption, color = AppTheme.colors.textPrimary)
                        }
                    }
                }
            }

            val available = suggestions.filter { !values.contains(it) && it.isNotBlank() }
            if (available.isNotEmpty()) {
                FlowRow(
                    modifier = Modifier.padding(top = AppSpacing.xs),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                ) {
                    available.forEach { tag ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(AppSpacing.sm))
                                .background(AppTheme.colors.accentSoft)
                                .clickable(role = Role.Button) { onValuesChange(values + tag) }
                                .padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm),
                        ) {
                            Text(tag, style = AppType.caption, color = AppTheme.colors.accent)
                        }
                    }
                }
            }
            FieldError(error)
    }
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier.padding(top = AppSpacing.sm),
    )
}

@Composable
fun FormSectionTitle(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        modifier = modifier,
    )
}






