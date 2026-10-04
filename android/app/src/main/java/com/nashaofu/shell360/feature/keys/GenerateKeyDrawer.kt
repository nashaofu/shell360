package com.nashaofu.shell360.feature.keys

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.nashaofu.shell360.core.data.ECDSA_CURVES
import com.nashaofu.shell360.core.data.KeyAlgorithm
import com.nashaofu.shell360.core.data.KeyModel
import com.nashaofu.shell360.core.data.RSA_BIT_SIZES
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppOutlinedButton
import com.nashaofu.shell360.ui.components.DrawerActions
import com.nashaofu.shell360.ui.components.FormPasswordField
import com.nashaofu.shell360.ui.components.FormSelectField
import com.nashaofu.shell360.ui.components.FormTextField
import com.nashaofu.shell360.ui.components.PageDrawer
import com.nashaofu.shell360.ui.components.SelectOption
import com.nashaofu.shell360.ui.theme.AppType
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun GenerateKeyDrawer(
    open: Boolean,
    onCancel: () -> Unit,
    onGenerated: (KeyModel) -> Unit,
) {
    var name by remember(open) { mutableStateOf("") }
    var algorithm by remember(open) { mutableStateOf("") }
    var bitSize by remember(open) { mutableStateOf("") }
    var curve by remember(open) { mutableStateOf("") }
    var passphrase by remember(open) { mutableStateOf("") }
    var submitted by remember(open) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val nameError = if (submitted && name.isBlank()) "Please enter name" else null
    val algorithmError = if (submitted && algorithm.isBlank()) "Please select algorithm" else null
    val bitSizeError =
        if (submitted && algorithm == KeyAlgorithm.Rsa.name && bitSize.isBlank()) "Please select bit size" else null
    val curveError =
        if (submitted && algorithm == KeyAlgorithm.Ecdsa.name && curve.isBlank()) "Please select curve" else null

    PageDrawer(
        open = open,
        title = "Generate key",
        onCancel = onCancel,
        footer = {
            DrawerActions {
                AppOutlinedButton(onClick = onCancel) { Text("Cancel", style = AppType.buttonLabel) }
                AppButton(
                    onClick = {
                        submitted = true
                        if (name.isBlank() || algorithm.isBlank()) return@AppButton
                        if (algorithm == KeyAlgorithm.Rsa.name && bitSize.isBlank()) return@AppButton
                        if (algorithm == KeyAlgorithm.Ecdsa.name && curve.isBlank()) return@AppButton

                        val algorithmParams = when (algorithm) {
                            KeyAlgorithm.Rsa.name -> JSONObject().put("type", "Rsa").put("bitSize", bitSize.toInt())
                            KeyAlgorithm.Ecdsa.name -> JSONObject().put("type", "Ecdsa").put("curve", curve)
                            else -> JSONObject().put("type", "Ed25519")
                        }
                        scope.launch {
                            runCatching { AndroidRuntime.generateKey(name.trim(), algorithmParams, passphrase) }
                                .onSuccess { key ->
                                    Shell360Store.addKey(key)
                                    onGenerated(key)
                                }
                                .onFailure { Toast.makeText(context, it.message ?: "Could not generate key", Toast.LENGTH_LONG).show() }
                        }
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("Generate", style = AppType.buttonLabel) }
            }
        },
    ) {
        FormTextField(
            label = "Name",
            value = name,
            onValueChange = { name = it },
            placeholder = "Name",
            error = nameError,
        )

        FormSelectField(
            label = "Algorithm",
            value = algorithm,
            options = KeyAlgorithm.entries.map { SelectOption(it.name, it.label) },
            onValueChange = { value ->
                algorithm = value
                if (value != KeyAlgorithm.Rsa.name) bitSize = ""
                if (value != KeyAlgorithm.Ecdsa.name) curve = ""
            },
            placeholder = "Select algorithm",
            error = algorithmError,
        )

        if (algorithm == KeyAlgorithm.Rsa.name) {
            FormSelectField(
                label = "Bit size",
                value = bitSize,
                options = RSA_BIT_SIZES.map { SelectOption(it.toString(), it.toString()) },
                onValueChange = { bitSize = it },
                placeholder = "Select bit size",
                error = bitSizeError,
            )
        }

        if (algorithm == KeyAlgorithm.Ecdsa.name) {
            FormSelectField(
                label = "Curve",
                value = curve,
                options = ECDSA_CURVES.map { SelectOption(it.second, it.first) },
                onValueChange = { curve = it },
                placeholder = "Select curve",
                error = curveError,
            )
        }

        FormPasswordField(
            label = "Passphrase",
            value = passphrase,
            onValueChange = { passphrase = it },
            placeholder = "Passphrase",
        )
    }
}
