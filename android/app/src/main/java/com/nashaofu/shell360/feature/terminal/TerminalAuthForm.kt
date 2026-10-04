package com.nashaofu.shell360.feature.terminal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nashaofu.shell360.core.data.AuthMethod
import com.nashaofu.shell360.core.data.KeyModel
import com.nashaofu.shell360.ui.components.FormPasswordField
import com.nashaofu.shell360.ui.components.FormSelectField
import com.nashaofu.shell360.ui.components.FormTextField
import com.nashaofu.shell360.ui.components.SelectOption
import com.nashaofu.shell360.ui.theme.AppSpacing

/** Sentinel value for the reference's leading `+ Add key` option in the key picker. */
const val ADD_KEY_OPTION_VALUE = "\u0000add-key"

/**
 * Mirrors `AuthenticationError/AuthenticationForm.tsx`: an authentication-method picker,
 * a password field for Password, and a key picker for PublicKey / Certificate whose first
 * entry opens the add-key flow.
 */
@Composable
fun TerminalAuthForm(
    method: AuthMethod,
    password: String,
    keyId: String,
    keys: List<KeyModel>,
    onMethodChange: (AuthMethod) -> Unit,
    onPasswordChange: (String) -> Unit,
    onKeyChange: (String) -> Unit,
    onOpenAddKey: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
    ) {
        FormSelectField(
            label = "Authentication method",
            value = method.name,
            options = AuthMethod.entries.map { SelectOption(it.name, it.label) },
            onValueChange = { name -> AuthMethod.entries.firstOrNull { it.name == name }?.let(onMethodChange) },
        )

        when (method) {
            AuthMethod.Password -> FormPasswordField(
                label = "Password",
                value = password,
                onValueChange = onPasswordChange,
            )

            AuthMethod.PublicKey, AuthMethod.Certificate -> FormSelectField(
                label = "Key",
                value = keyId,
                options = listOf(SelectOption(ADD_KEY_OPTION_VALUE, "+ Add key")) +
                    keys.map { SelectOption(it.id, it.name) },
                onValueChange = { value ->
                    if (value == ADD_KEY_OPTION_VALUE) onOpenAddKey() else onKeyChange(value)
                },
            )

            AuthMethod.Agent, AuthMethod.KeyboardInteractive -> Unit
        }
    }
}

/** Mirrors the keyboard-interactive prompt form: the prompt lives in the mask title. */
@Composable
fun KeyboardInteractiveForm(
    answer: String,
    onAnswerChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    FormTextField(
        label = "Response",
        value = answer,
        onValueChange = onAnswerChange,
        placeholder = "Please answer the prompts.",
        modifier = modifier.fillMaxWidth(),
    )
}
