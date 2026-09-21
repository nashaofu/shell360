package com.nashaofu.shell360.nativeui

import com.nashaofu.shell360.terminal.NativeRuntimeClient
import java.util.UUID
import org.json.JSONObject

class NativeSshSession(private val runtime: NativeRuntimeClient, existingId: String? = null) {
    val id: String = existingId ?: UUID.randomUUID().toString()

    fun connect(host: NativeHost, checkServerKey: String? = null, onResult: (Result<Unit>) -> Unit) {
        val data = JSONObject().put("sshSessionId", id).put("hostname", host.hostname).put("port", host.port)
        checkServerKey?.let { data.put("checkServerKey", it) }
        runtime.request("ssh.session.connect", data) { response -> onResult(response.result()) }
    }

    fun authenticate(host: NativeHost, key: NativeKey?, onResult: (Result<Unit>) -> Unit) {
        val method = when (host.authenticationMethod) {
            NativeAuthenticationMethod.Password -> "ssh.session.authenticatePassword"
            NativeAuthenticationMethod.PublicKey -> "ssh.session.authenticatePublicKey"
            NativeAuthenticationMethod.Certificate -> "ssh.session.authenticateCertificate"
            NativeAuthenticationMethod.Agent -> "ssh.session.authenticateAgent"
            NativeAuthenticationMethod.KeyboardInteractive -> "ssh.session.authenticateKeyboardInteractive"
        }
        val data = JSONObject().put("sshSessionId", id).put("username", host.username)
        when (host.authenticationMethod) {
            NativeAuthenticationMethod.Password -> data.put("password", host.password)
            NativeAuthenticationMethod.PublicKey, NativeAuthenticationMethod.Certificate -> {
                data.put("privateKey", key?.privateKey.orEmpty()).put("passphrase", key?.passphrase.orEmpty())
                if (host.authenticationMethod == NativeAuthenticationMethod.Certificate) data.put("certificate", key?.certificate.orEmpty())
            }
            else -> Unit
        }
        runtime.request(method, data) { response -> onResult(response.result()) }
    }

    fun authenticateKeyboardInteractive(answers: List<String>, onResult: (Result<Unit>) -> Unit) {
        runtime.request(
            "ssh.session.authenticateKeyboardInteractive",
            JSONObject().put("sshSessionId", id).put("prompts", org.json.JSONArray(answers)),
        ) { response -> onResult(response.result()) }
    }

    fun disconnect(onResult: () -> Unit = {}) {
        runtime.request("ssh.session.disconnect", JSONObject().put("sshSessionId", id)) { onResult() }
    }
}

data class NativeSshFailure(val code: String, override val message: String, val details: JSONObject?) : Exception(message)

fun JSONObject.result(): Result<Unit> {
    if (!has("error")) return Result.success(Unit)
    val error = optJSONObject("error") ?: JSONObject()
    return Result.failure(NativeSshFailure(error.optString("code"), error.optString("message"), error.optJSONObject("details")))
}
