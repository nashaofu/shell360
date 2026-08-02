package com.nashaofu.shell360.bridge

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.nashaofu.shell360.BuildConfig
import java.util.UUID
import org.json.JSONException
import org.json.JSONObject

class BridgeRouter(
    private val context: Context,
    private val rustBridge: RustBridge,
    private val fileBridge: AndroidFileBridge? = null,
    private val closeWindow: () -> Unit,
    private val resetApplication: () -> Unit,
    private val setSystemBarsAppearance: (Boolean) -> Unit,
) {
    private val preferences = context.getSharedPreferences("shell360-platform", Context.MODE_PRIVATE)

    fun handle(message: String): String {
        var requestId: String? = null
        return try {
            val request = BridgeRequest.parse(message)
            requestId = request.id

            when {
                request.method == "bridge.health" -> {
                    BridgeResponse.success(request.id, rustBridge.healthCheck())
                }
                request.method == "bridge.releaseClient" -> {
                    rustBridge.releaseClient(request.clientId)
                    BridgeResponse.success(request.id, null)
                }
                request.method == "keygen.generate" -> {
                    BridgeResponse.success(request.id, rustBridge.invokeKeygen(request.params))
                }
                request.method.startsWith("data.") -> {
                    val result = rustBridge.invokeData(request.method, request.params)
                    if (
                        request.method == "data.resetCrypto" &&
                        result is JSONObject &&
                        result.optBoolean("restartRequired")
                    ) {
                        resetApplication()
                    }
                    BridgeResponse.success(
                        request.id,
                        result,
                    )
                }
                request.method == "ssh.sftp.uploadFile" -> {
                    BridgeResponse.success(
                        request.id,
                        invokeSftpUpload(request.clientId, request.params),
                    )
                }
                request.method == "ssh.sftp.downloadFile" -> {
                    BridgeResponse.success(
                        request.id,
                        invokeSftpDownload(request.clientId, request.params),
                    )
                }
                request.method.startsWith("ssh.") -> {
                    BridgeResponse.success(
                        request.id,
                        rustBridge.invokeSsh(request.method, request.clientId, request.params),
                    )
                }
                request.method == "app.getVersion" -> {
                    BridgeResponse.success(request.id, BuildConfig.VERSION_NAME)
                }
                request.method == "app.setSystemBarsAppearance" -> {
                    val params = request.params as? JSONObject
                        ?: throw NativeBridgeException(
                            "BRIDGE_INVALID_REQUEST",
                            "app.setSystemBarsAppearance requires parameters.",
                        )
                    val dark = params.opt("dark")
                    if (dark !is Boolean) {
                        throw NativeBridgeException(
                            "BRIDGE_INVALID_REQUEST",
                            "app.setSystemBarsAppearance requires a dark boolean.",
                        )
                    }
                    setSystemBarsAppearance(dark)
                    BridgeResponse.success(request.id, null)
                }
                request.method == "machineUid.getMachineUid" -> {
                    BridgeResponse.success(request.id, getMachineUid())
                }
                request.method == "core.openUrl" -> {
                    openUrl(requireStringParam(request.params, "url"))
                    BridgeResponse.success(request.id, null)
                }
                request.method == "clipboard.readText" -> {
                    val clipboard = context.getSystemService(ClipboardManager::class.java)
                    val text = clipboard.primaryClip
                        ?.takeIf { it.itemCount > 0 }
                        ?.getItemAt(0)
                        ?.coerceToText(context)
                        ?.toString()
                        .orEmpty()
                    BridgeResponse.success(request.id, text)
                }
                request.method == "clipboard.writeText" -> {
                    val text = requireStringParam(request.params, "text")
                    context.getSystemService(ClipboardManager::class.java)
                        .setPrimaryClip(ClipData.newPlainText("Shell360", text))
                    BridgeResponse.success(request.id, null)
                }
                request.method == "dialog.open" -> {
                    BridgeResponse.success(request.id, requireFileBridge().open())
                }
                request.method == "dialog.save" -> {
                    val defaultPath = (request.params as? JSONObject)
                        ?.optString("defaultPath")
                        ?.takeIf(String::isNotBlank)
                        ?: "shell360.json"
                    BridgeResponse.success(request.id, requireFileBridge().save(defaultPath))
                }
                request.method == "fs.readTextFile" -> {
                    BridgeResponse.success(
                        request.id,
                        readTextFile(
                            requireStringParam(request.params, "path"),
                            request.params as? JSONObject,
                        ),
                    )
                }
                request.method == "fs.writeTextFile" -> {
                    writeTextFile(
                        requireStringParam(request.params, "path"),
                        requireStringParam(request.params, "contents"),
                        request.params as? JSONObject,
                    )
                    BridgeResponse.success(request.id, null)
                }
                request.method == "window.close" -> {
                    closeWindow()
                    BridgeResponse.success(request.id, null)
                }
                else -> BridgeResponse.error(
                    request.id,
                    "BRIDGE_UNSUPPORTED",
                    "${request.method} is not implemented by the Android bridge.",
                )
            }
        } catch (error: NativeBridgeException) {
            BridgeResponse.error(
                requestId,
                error.code,
                error.message,
                error.details,
            )
        } catch (error: JSONException) {
            BridgeResponse.error(
                requestId,
                "BRIDGE_INVALID_REQUEST",
                error.message ?: "Native bridge request is not valid JSON.",
            )
        } catch (error: Exception) {
            BridgeResponse.error(
                requestId,
                "BRIDGE_NATIVE_ERROR",
                error.message ?: "Native bridge request failed.",
            )
        }
    }

    private fun getMachineUid(): String {
        preferences.getString(MACHINE_UID_KEY, null)?.let {
            return it
        }

        return UUID.randomUUID().toString().also {
            preferences.edit().putString(MACHINE_UID_KEY, it).apply()
        }
    }

    private fun openUrl(value: String) {
        val uri = Uri.parse(value)
        if (uri.scheme?.lowercase() !in EXTERNAL_SCHEMES) {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "External URL scheme is not allowed.",
            )
        }

        val intent = Intent(Intent.ACTION_VIEW, uri)
            .addCategory(Intent.CATEGORY_BROWSABLE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(context.packageManager) == null) {
            throw NativeBridgeException(
                "BRIDGE_UNAVAILABLE",
                "No application can open this URL.",
            )
        }

        try {
            context.startActivity(intent)
        } catch (error: ActivityNotFoundException) {
            throw NativeBridgeException(
                "BRIDGE_UNAVAILABLE",
                "The application for this URL is no longer available.",
            )
        } catch (error: SecurityException) {
            throw NativeBridgeException(
                "BRIDGE_REJECTED",
                "Opening this URL was rejected by Android.",
            )
        }
    }

    private fun requireStringParam(params: Any?, name: String): String {
        val value = (params as? JSONObject)?.opt(name)
        if (value !is String) {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "$name must be a string.",
            )
        }
        return value
    }

    private fun requireFileBridge() = fileBridge ?: throw NativeBridgeException(
        "BRIDGE_UNAVAILABLE",
        "The Android file picker is not available.",
    )

    private fun readTextFile(path: String, params: JSONObject?): String {
        if (params?.optString("baseDir") == "appLocalData") {
            return resolveAppDataFile(path).readText()
        }
        val uri = requireContentUri(path)
        return context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            ?: throw NativeBridgeException("BRIDGE_IO_ERROR", "The selected file could not be read.")
    }

    private fun writeTextFile(path: String, contents: String, params: JSONObject?) {
        if (params?.optString("baseDir") == "appLocalData") {
            val file = resolveAppDataFile(path)
            file.parentFile?.mkdirs()
            file.writeText(contents)
            return
        }
        val uri = requireContentUri(path)
        context.contentResolver.openOutputStream(uri, "wt")?.bufferedWriter()?.use {
            it.write(contents)
        } ?: throw NativeBridgeException("BRIDGE_IO_ERROR", "The selected file could not be written.")
    }

    private fun resolveAppDataFile(path: String): java.io.File {
        val root = context.filesDir.resolve("shell360").canonicalFile
        val file = root.resolve(path).canonicalFile
        if (file != root && !file.toPath().startsWith(root.toPath())) {
            throw NativeBridgeException("BRIDGE_INVALID_REQUEST", "The app data path is invalid.")
        }
        return file
    }

    private fun requireContentUri(path: String): Uri {
        val uri = Uri.parse(path)
        if (uri.scheme != "content") {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "Android file access requires a content URI.",
            )
        }
        return uri
    }

    private fun invokeSftpUpload(clientId: String, params: Any?): Any? {
        val request = params as? JSONObject
            ?: throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "SFTP upload requires parameters.",
            )
        val source = requireContentUri(requireStringParam(request, "localFilename"))
        val temporary = createTransferFile()
        try {
            context.contentResolver.openInputStream(source)?.use { input ->
                temporary.outputStream().use(input::copyTo)
            } ?: throw NativeBridgeException(
                "BRIDGE_IO_ERROR",
                "The selected upload file could not be read.",
            )
            request.put("localFilename", temporary.absolutePath)
            return rustBridge.invokeSsh("ssh.sftp.uploadFile", clientId, request)
        } finally {
            temporary.delete()
        }
    }

    private fun invokeSftpDownload(clientId: String, params: Any?): Any? {
        val request = params as? JSONObject
            ?: throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "SFTP download requires parameters.",
            )
        val target = requireContentUri(requireStringParam(request, "localFilename"))
        val temporary = createTransferFile()
        try {
            request.put("localFilename", temporary.absolutePath)
            val result = rustBridge.invokeSsh("ssh.sftp.downloadFile", clientId, request)
            context.contentResolver.openOutputStream(target, "wt")?.use { output ->
                temporary.inputStream().use { input -> input.copyTo(output) }
            } ?: throw NativeBridgeException(
                "BRIDGE_IO_ERROR",
                "The selected download destination could not be written.",
            )
            return result
        } finally {
            temporary.delete()
        }
    }

    private fun createTransferFile(): java.io.File {
        val directory = context.cacheDir.resolve("shell360/transfers")
        directory.mkdirs()
        return directory.resolve(UUID.randomUUID().toString())
    }

    private companion object {
        const val MACHINE_UID_KEY = "machine_uid"
        val EXTERNAL_SCHEMES = setOf("http", "https", "mailto", "tel")
    }
}
