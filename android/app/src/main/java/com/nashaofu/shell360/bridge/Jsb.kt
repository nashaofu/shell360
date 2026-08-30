package com.nashaofu.shell360.bridge

import com.nashaofu.shell360.ffi.FfiException
import com.nashaofu.shell360.ffi.NativeJsbConnection
import com.nashaofu.shell360.ffi.NativeJsbRegistry
import android.content.ClipboardManager
import android.content.Context
import com.nashaofu.shell360.BuildConfig
import java.util.UUID
import org.json.JSONObject
import org.json.JSONTokener

data class JsbContext(val clientId: String, val method: String)

typealias JsbHandler = (JsbContext, Any?) -> Any?

class Jsb {
    private val registry = NativeJsbRegistry()
    private val handlers = mutableMapOf<String, JsbHandler>()
    private var connection: NativeJsbConnection? = null
    private var clientId: String? = null

    fun register(method: String, callback: JsbHandler) {
        check(method !in handlers) { "Duplicate JSB method: $method" }
        registry.register(method)
        handlers[method] = callback
    }

    fun connect(): String? {
        val releasedClientId = close()
        connection = registry.connect()
        clientId = UUID.randomUUID().toString()
        return releasedClientId
    }

    fun dispatch(message: String): String {
        val active = connection ?: return dispatchError(message, "JSB is not connected.")
        val request = try {
            JSONObject(message)
        } catch (error: Exception) {
            return dispatchError(message, error.message ?: "JSB request is invalid.")
        }
        val requestId = request.optString("id")
        val method = request.optString("method")
        if (
            request.optString("type") != "invoke.request" ||
            requestId.isBlank() ||
            method.isBlank()
        ) {
            return dispatchError(message, "JSB request must contain a non-empty id and method.")
        }
        if (method !in handlers) {
            return BridgeResponse.error(
                requestId,
                "JSB_UNSUPPORTED",
                "JSB handler is unavailable: $method",
            )
        }
        val nativeRequest = JSONObject()
            .put("type", "invoke")
            .put("id", requestId)
            .put("clientId", clientId)
            .put("method", method)
            .put("params", if (request.has("data")) request.opt("data") else JSONObject.NULL)
            .toString()
        val call = try {
            active.dispatch(nativeRequest)
        } catch (error: FfiException) {
            return dispatchError(message, error.message ?: "JSB dispatch failed.")
        }
        val handler = checkNotNull(handlers[call.method])
        return try {
            val params = JSONTokener(call.paramsJson).nextValue().takeUnless { it == JSONObject.NULL }
            response(
                active.resolve(
                    call.requestId,
                    handler(JsbContext(call.clientId, call.method), params).toJson(),
                ),
            )
        } catch (error: NativeBridgeException) {
            response(
                active.reject(
                    call.requestId,
                    error.code,
                    error.message,
                    error.details?.toJson(),
                ),
            )
        } catch (error: Exception) {
            response(
                active.reject(
                    call.requestId,
                    "JSB_NATIVE_ERROR",
                    error.message ?: "JSB handler failed.",
                    null,
                ),
            )
        }
    }

    fun close(): String? {
        val clientId = connection?.disconnect()
        connection = null
        this.clientId = null
        return clientId
    }

    private fun dispatchError(message: String, reason: String): String {
        val id = runCatching { JSONObject(message).optString("id") }.getOrDefault("")
        return BridgeResponse.error(id, "JSB_INVALID_MESSAGE", reason)
    }

    private fun response(message: String): String {
        val response = JSONObject(message)
        return if (response.has("error")) {
            BridgeResponse.error(
                response.optString("id"),
                response.getJSONObject("error").optString("code"),
                response.getJSONObject("error").optString("message"),
                response.getJSONObject("error").opt("details").takeUnless { it == JSONObject.NULL },
            )
        } else {
            BridgeResponse.success(
                response.optString("id"),
                response.opt("result").takeUnless { it == JSONObject.NULL },
            )
        }
    }

    private fun Any?.toJson(): String {
        return when (this) {
            null -> "null"
            is String -> JSONObject.quote(this)
            else -> JSONObject.wrap(this)?.toString() ?: "null"
        }
    }
}

fun Jsb.registerAndroidRoutes(router: AndroidBridgeServices, context: Context) {
    register("bridge.health") { _, _ -> mapOf("status" to "ok") }
    register("app.getVersion") { _, _ -> BuildConfig.VERSION_NAME }
    register("app.setSystemBarsAppearance") { _, params ->
        val value = params as? JSONObject ?: throw NativeBridgeException("BRIDGE_INVALID_REQUEST", "dark is required.")
        val dark = value.opt("dark")
        if (dark !is Boolean) throw NativeBridgeException("BRIDGE_INVALID_REQUEST", "dark must be a boolean.")
        router.setSystemBarsAppearance(dark)
        null
    }
    register("machineUid.getMachineUid") { _, _ ->
        val preferences = context.getSharedPreferences("shell360-platform", Context.MODE_PRIVATE)
        preferences.getString("machine_uid", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("machine_uid", it).apply()
        }
    }
    register("clipboard.readText") { _, _ ->
        context.getSystemService(ClipboardManager::class.java)
            .primaryClip
            ?.takeIf { it.itemCount > 0 }
            ?.getItemAt(0)
            ?.coerceToText(context)
            ?.toString()
            .orEmpty()
    }
    register("clipboard.writeText") { _, params ->
        val text = router.requireStringParam(params, "text")
        context.getSystemService(ClipboardManager::class.java).setPrimaryClip(android.content.ClipData.newPlainText("Shell360", text))
        null
    }
    register("core.openUrl") { _, params -> router.openUrl(router.requireStringParam(params, "url")); null }
    register("dialog.open") { _, _ -> router.requireFileBridge().open() }
    register("dialog.save") { _, params ->
        val name = (params as? JSONObject)?.optString("defaultPath")?.takeIf(String::isNotBlank) ?: "shell360.json"
        router.requireFileBridge().save(name)
    }
    register("fs.readTextFile") { _, params ->
        val value = params as? JSONObject ?: throw NativeBridgeException("BRIDGE_INVALID_REQUEST", "path is required.")
        router.readTextFile(router.requireStringParam(value, "path"), value)
    }
    register("fs.writeTextFile") { _, params ->
        val value = params as? JSONObject ?: throw NativeBridgeException("BRIDGE_INVALID_REQUEST", "path is required.")
        router.writeTextFile(router.requireStringParam(value, "path"), router.requireStringParam(value, "contents"), value)
        null
    }
    register("window.close") { _, _ -> router.closeWindow(); null }
    register("keygen.generate") { _, params -> router.rustBridge.invokeKeygen(params) }
    register("data.checkIsEnableCrypto") { _, params -> router.rustBridge.invokeData("data.checkIsEnableCrypto", params) }
    register("data.checkIsInitCrypto") { _, params -> router.rustBridge.invokeData("data.checkIsInitCrypto", params) }
    register("data.checkIsAuthed") { _, params -> router.rustBridge.invokeData("data.checkIsAuthed", params) }
    register("data.initCryptoKey") { _, params -> router.rustBridge.invokeData("data.initCryptoKey", params) }
    register("data.initCryptoPassword") { _, params -> router.rustBridge.invokeData("data.initCryptoPassword", params) }
    register("data.loadCryptoByPassword") { _, params -> router.rustBridge.invokeData("data.loadCryptoByPassword", params) }
    register("data.changeCryptoPassword") { _, params -> router.rustBridge.invokeData("data.changeCryptoPassword", params) }
    register("data.initCryptoBiometric") { _, params -> router.rustBridge.invokeData("data.initCryptoBiometric", params) }
    register("data.loadCryptoByBiometric") { _, params -> router.rustBridge.invokeData("data.loadCryptoByBiometric", params) }
    register("data.changeCryptoEnable") { _, params -> router.rustBridge.invokeData("data.changeCryptoEnable", params) }
    register("data.resetCrypto") { _, params ->
        router.rustBridge.invokeData("data.resetCrypto", params).also { result ->
            if (result is JSONObject && result.optBoolean("restartRequired")) {
                router.resetApplication()
            }
        }
    }
    register("data.rotateCryptoKey") { _, params -> router.rustBridge.invokeData("data.rotateCryptoKey", params) }
    register("data.getHosts") { _, params -> router.rustBridge.invokeData("data.getHosts", params) }
    register("data.addHost") { _, params -> router.rustBridge.invokeData("data.addHost", params) }
    register("data.updateHost") { _, params -> router.rustBridge.invokeData("data.updateHost", params) }
    register("data.deleteHost") { _, params -> router.rustBridge.invokeData("data.deleteHost", params) }
    register("data.getKeys") { _, params -> router.rustBridge.invokeData("data.getKeys", params) }
    register("data.addKey") { _, params -> router.rustBridge.invokeData("data.addKey", params) }
    register("data.updateKey") { _, params -> router.rustBridge.invokeData("data.updateKey", params) }
    register("data.deleteKey") { _, params -> router.rustBridge.invokeData("data.deleteKey", params) }
    register("data.getPortForwardings") { _, params -> router.rustBridge.invokeData("data.getPortForwardings", params) }
    register("data.addPortForwarding") { _, params -> router.rustBridge.invokeData("data.addPortForwarding", params) }
    register("data.updatePortForwarding") { _, params -> router.rustBridge.invokeData("data.updatePortForwarding", params) }
    register("data.deletePortForwarding") { _, params -> router.rustBridge.invokeData("data.deletePortForwarding", params) }
    register("ssh.session.connect") { context, params -> router.rustBridge.invokeSsh("ssh.session.connect", context.clientId, params) }
    register("ssh.session.authenticatePassword") { context, params -> router.rustBridge.invokeSsh("ssh.session.authenticatePassword", context.clientId, params) }
    register("ssh.session.authenticatePublicKey") { context, params -> router.rustBridge.invokeSsh("ssh.session.authenticatePublicKey", context.clientId, params) }
    register("ssh.session.authenticateCertificate") { context, params -> router.rustBridge.invokeSsh("ssh.session.authenticateCertificate", context.clientId, params) }
    register("ssh.session.authenticateKeyboardInteractive") { context, params -> router.rustBridge.invokeSsh("ssh.session.authenticateKeyboardInteractive", context.clientId, params) }
    register("ssh.session.authenticateAgent") { context, params -> router.rustBridge.invokeSsh("ssh.session.authenticateAgent", context.clientId, params) }
    register("ssh.session.disconnect") { context, params -> router.rustBridge.invokeSsh("ssh.session.disconnect", context.clientId, params) }
    register("ssh.shell.open") { context, params -> router.rustBridge.invokeSsh("ssh.shell.open", context.clientId, params) }
    register("ssh.shell.send") { context, params -> router.rustBridge.invokeSsh("ssh.shell.send", context.clientId, params) }
    register("ssh.shell.resize") { context, params -> router.rustBridge.invokeSsh("ssh.shell.resize", context.clientId, params) }
    register("ssh.shell.close") { context, params -> router.rustBridge.invokeSsh("ssh.shell.close", context.clientId, params) }
    register("ssh.sftp.open") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.open", context.clientId, params) }
    register("ssh.sftp.close") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.close", context.clientId, params) }
    register("ssh.sftp.readDir") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.readDir", context.clientId, params) }
    register("ssh.sftp.createFile") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.createFile", context.clientId, params) }
    register("ssh.sftp.createDir") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.createDir", context.clientId, params) }
    register("ssh.sftp.removeFile") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.removeFile", context.clientId, params) }
    register("ssh.sftp.removeDir") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.removeDir", context.clientId, params) }
    register("ssh.sftp.rename") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.rename", context.clientId, params) }
    register("ssh.sftp.exists") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.exists", context.clientId, params) }
    register("ssh.sftp.canonicalize") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.canonicalize", context.clientId, params) }
    register("ssh.sftp.readTextFile") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.readTextFile", context.clientId, params) }
    register("ssh.sftp.writeTextFile") { context, params -> router.rustBridge.invokeSsh("ssh.sftp.writeTextFile", context.clientId, params) }
    register("ssh.sftp.uploadFile") { context, params -> router.invokeSftpUpload(context.clientId, params) }
    register("ssh.sftp.downloadFile") { context, params -> router.invokeSftpDownload(context.clientId, params) }
    register("ssh.portForwarding.openLocal") { context, params -> router.rustBridge.invokeSsh("ssh.portForwarding.openLocal", context.clientId, params) }
    register("ssh.portForwarding.closeLocal") { context, params -> router.rustBridge.invokeSsh("ssh.portForwarding.closeLocal", context.clientId, params) }
    register("ssh.portForwarding.openRemote") { context, params -> router.rustBridge.invokeSsh("ssh.portForwarding.openRemote", context.clientId, params) }
    register("ssh.portForwarding.closeRemote") { context, params -> router.rustBridge.invokeSsh("ssh.portForwarding.closeRemote", context.clientId, params) }
    register("ssh.portForwarding.openDynamic") { context, params -> router.rustBridge.invokeSsh("ssh.portForwarding.openDynamic", context.clientId, params) }
    register("ssh.portForwarding.closeDynamic") { context, params -> router.rustBridge.invokeSsh("ssh.portForwarding.closeDynamic", context.clientId, params) }
}
