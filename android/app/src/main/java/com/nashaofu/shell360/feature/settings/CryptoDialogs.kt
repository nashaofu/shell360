package com.nashaofu.shell360.feature.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.FormPasswordField
import com.nashaofu.shell360.ui.theme.AppSpacing

@Composable
fun InitCryptoDialog(
    open: Boolean,
    onCancel: () -> Unit,
    onSubmit: (String) -> Unit,
) {
    if (!open) return

    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf(false) }

    val passwordError = when {
        !submitted -> null
        password.isBlank() -> "Please enter password"
        password.length < CRYPTO_PASSWORD_MIN_LENGTH ->
            "Please enter at least $CRYPTO_PASSWORD_MIN_LENGTH characters"

        password.length > CRYPTO_PASSWORD_MAX_LENGTH ->
            "Please enter no more than $CRYPTO_PASSWORD_MAX_LENGTH characters"

        else -> null
    }
    val confirmError = when {
        !submitted -> null
        confirmPassword.isBlank() -> "Please enter confirm password"
        confirmPassword != password -> "The password confirmation does not match the password"
        else -> null
    }

    AppDialog(
        open = true,
        title = "Initialize Crypto",
        onDismiss = onCancel,
        content = {
            Column(Modifier.fillMaxWidth()) {
                Text("Set an encrypted password to protect application data")
                Spacer(Modifier.height(AppSpacing.lg))
                FormPasswordField(
                    label = "Password",
                    value = password,
                    onValueChange = { password = it },
                    placeholder = "Password",
                    error = passwordError,
                )
                Spacer(Modifier.height(AppSpacing.md))
                FormPasswordField(
                    label = "Confirm Password",
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    placeholder = "Confirm password",
                    error = confirmError,
                )
            }
        },
        actions = {
            AppTextButton(
                onClick = {
                    submitted = true
                    if (password.isNotBlank() && password == confirmPassword) {
                        onSubmit(password)
                    }
                },
            ) { Text("Submit") }

            AppTextButton(onClick = onCancel) { Text("Cancel") }
        },
    )
}

@Composable
fun ChangeCryptoPasswordDialog(
    open: Boolean,
    onCancel: () -> Unit,
    onSubmit: (String, String) -> Unit,
) {
    if (!open) return

    var oldPassword by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf(false) }

    val oldPasswordError = when {
        !submitted -> null
        oldPassword.isBlank() -> "Please enter old password"
        oldPassword.length < CRYPTO_PASSWORD_MIN_LENGTH ->
            "Please enter at least $CRYPTO_PASSWORD_MIN_LENGTH characters"

        else -> null
    }
    val passwordError = when {
        !submitted -> null
        password.isBlank() -> "Please enter password"
        password.length < CRYPTO_PASSWORD_MIN_LENGTH ->
            "Please enter at least $CRYPTO_PASSWORD_MIN_LENGTH characters"

        password.length > CRYPTO_PASSWORD_MAX_LENGTH ->
            "Please enter no more than $CRYPTO_PASSWORD_MAX_LENGTH characters"

        else -> null
    }
    val confirmError = when {
        !submitted -> null
        confirmPassword.isBlank() -> "Please enter confirm password"
        confirmPassword != password -> "The password confirmation does not match the password"
        else -> null
    }

    AppDialog(
        open = true,
        title = "Change Crypto Password",
        onDismiss = onCancel,
        content = {
            Column(Modifier.fillMaxWidth()) {
                Text("Please enter the encryption password to reset the key")
                Spacer(Modifier.height(AppSpacing.lg))
                FormPasswordField(
                    label = "Old Password",
                    value = oldPassword,
                    onValueChange = { oldPassword = it },
                    placeholder = "Old Password",
                    error = oldPasswordError,
                )
                Spacer(Modifier.height(AppSpacing.md))
                FormPasswordField(
                    label = "Password",
                    value = password,
                    onValueChange = { password = it },
                    placeholder = "Password",
                    error = passwordError,
                )
                Spacer(Modifier.height(AppSpacing.md))
                FormPasswordField(
                    label = "Confirm Password",
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    placeholder = "Confirm password",
                    error = confirmError,
                )
            }
        },
        actions = {
            AppTextButton(
                onClick = {
                    submitted = true
                    if (oldPassword.isNotBlank() && password.isNotBlank() && password == confirmPassword) {
                        onSubmit(oldPassword, password)
                    }
                },
            ) { Text("Submit") }
            AppTextButton(onClick = onCancel) { Text("Cancel") }
        },
    )
}
