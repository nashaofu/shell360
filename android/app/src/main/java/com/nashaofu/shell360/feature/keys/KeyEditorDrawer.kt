package com.nashaofu.shell360.feature.keys

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.nashaofu.shell360.core.data.KeyModel
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppOutlinedButton
import com.nashaofu.shell360.ui.components.DrawerActions
import com.nashaofu.shell360.ui.components.FormPasswordField
import com.nashaofu.shell360.ui.components.FormTextField
import com.nashaofu.shell360.ui.components.PageDrawer
import com.nashaofu.shell360.ui.theme.AppType
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch

/** Shared "Add key"/"Edit key" drawer, reusable from the host editor like the webview `AddKey`. */
@Composable
fun KeyEditorDrawer(
    open: Boolean,
    data: KeyModel?,
    onCancel: () -> Unit,
    onSaved: (KeyModel) -> Unit,
    onImportFile: ((KeyImportField) -> Unit)? = null,
    fullscreen: Boolean = false,
) {
    var draft by remember(open, data) { mutableStateOf(data ?: KeyModel()) }
    var submitted by remember(open, data) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val nameError = if (submitted && draft.name.isBlank()) "Please enter name" else null
    val privateKeyError = if (submitted && draft.privateKey.isBlank()) "Please enter private key" else null

    PageDrawer(
        open = open,
        title = if (data == null) "Add key" else "Edit key",
        onCancel = onCancel,
        footer = {
            DrawerActions {
                AppOutlinedButton(onClick = onCancel) { Text("Cancel", style = AppType.buttonLabel) }
                AppButton(
                    onClick = {
                        submitted = true
                        if (draft.name.isNotBlank() && draft.privateKey.isNotBlank()) {
                            scope.launch {
                                runCatching { AndroidRuntime.saveKey(draft) }
                                    .onSuccess { saved ->
                                        Shell360Store.saveKey(saved)
                                        onSaved(saved)
                                    }
                                    .onFailure { Toast.makeText(context, it.message ?: "Could not save key", Toast.LENGTH_LONG).show() }
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("Save", style = AppType.buttonLabel) }
            }
        },
        fullscreen = fullscreen,
    ) {
        FormTextField(
            label = "Name",
            value = draft.name,
            onValueChange = { draft = draft.copy(name = it) },
            placeholder = "Name",
            error = nameError,
        )

        ImportableField(
            label = "Private key",
            value = draft.privateKey,
            onValueChange = { draft = draft.copy(privateKey = it) },
            placeholder = "Private key",
            error = privateKeyError,
            minLines = 6,
            importEnabled = onImportFile != null,
            onImport = { onImportFile?.invoke(KeyImportField.PrivateKey) },
        )

        ImportableField(
            label = "Public key",
            value = draft.publicKey,
            onValueChange = { draft = draft.copy(publicKey = it) },
            placeholder = "Public key",
            importEnabled = onImportFile != null,
            onImport = { onImportFile?.invoke(KeyImportField.PublicKey) },
        )

        FormPasswordField(
            label = "Passphrase",
            value = draft.passphrase,
            onValueChange = { draft = draft.copy(passphrase = it) },
            placeholder = "Passphrase",
        )

        ImportableField(
            label = "Certificate",
            value = draft.certificate,
            onValueChange = { draft = draft.copy(certificate = it) },
            placeholder = "Certificate",
            importEnabled = onImportFile != null,
            onImport = { onImportFile?.invoke(KeyImportField.Certificate) },
        )
    }
}

enum class KeyImportField { PrivateKey, PublicKey, Certificate }

@Composable
private fun ImportableField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    error: String? = null,
    minLines: Int = 6,
    importEnabled: Boolean,
    onImport: () -> Unit,
) {
    FormTextField(
        label = label,
        value = value,
        onValueChange = onValueChange,
        placeholder = placeholder,
        error = error,
        singleLine = false,
        minLines = minLines,
        headerTrailing = {
            IconButton(onClick = onImport, enabled = importEnabled) {
                Icon(Icons.Filled.UploadFile, contentDescription = "Import $label")
            }
        },
    )
}
