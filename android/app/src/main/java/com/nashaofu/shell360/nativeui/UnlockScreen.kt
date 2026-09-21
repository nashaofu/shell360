package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import com.nashaofu.shell360.terminal.NativeRuntimeClient
import org.json.JSONObject
import com.nashaofu.shell360.R

@Composable
fun UnlockScreen(runtime: NativeRuntimeClient, onUnlocked: () -> Unit) {
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var confirmReset by remember { mutableStateOf(false) }
    var unlocking by remember { mutableStateOf(false) }
    Scaffold { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        ) {
            Surface(
                modifier = Modifier.fillMaxWidth().widthIn(max = 360.dp),
                shape = RoundedCornerShape(12.dp),
                color = androidx.compose.material3.MaterialTheme.colorScheme.surface,
                shadowElevation = 8.dp,
            ) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) {
                androidx.compose.foundation.Image(painterResource(R.drawable.ic_lock), "Locked", Modifier.size(44.dp), colorFilter = ColorFilter.tint(androidx.compose.material3.MaterialTheme.colorScheme.primary))
            }
            Text("Application Locked", fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            Text("Enter your password to unlock", fontSize = 14.sp, color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
            androidx.compose.foundation.layout.Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(10.dp),
                placeholder = { Text("Please enter the password") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
            )
            if (error.isNotBlank()) Text(error, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            androidx.compose.foundation.layout.Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    unlocking = true
                    runtime.request("data.loadCryptoByPassword", JSONObject().put("password", password)) { response ->
                        if (response.has("error")) {
                            unlocking = false
                            error = response.optJSONObject("error")?.optString("message") ?: "Unlock failed"
                        } else onUnlocked()
                    }
                },
                enabled = password.isNotBlank() && !unlocking,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(10.dp),
            ) {
                if (unlocking) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Text(if (unlocking) "Unlocking…" else "Unlock", fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            }
            TextButton(onClick = { confirmReset = true }, modifier = Modifier.fillMaxWidth()) { Text("Reset all data") }
            }
            }
        }
    }
    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text("Reset application?") },
            text = { Text("All application data will be reset soon, whether to continue.") },
            confirmButton = {
                Button(onClick = {
                    confirmReset = false
                    runtime.request("data.resetCrypto") { response ->
                        if (response.has("error")) error = response.optJSONObject("error")?.optString("message") ?: "Reset failed"
                        else onUnlocked()
                    }
                }) { Text("Reset") }
            },
            dismissButton = { TextButton(onClick = { confirmReset = false }) { Text("Cancel") } },
        )
    }
}
