package com.nashaofu.shell360.bridge

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import java.util.UUID
import org.json.JSONObject

class AndroidBridgeServices(
    internal val context: Context,
    internal val rustBridge: RustBridge,
    internal val fileBridge: AndroidFileBridge? = null,
    internal val closeWindow: () -> Unit,
    internal val resetApplication: () -> Unit,
    internal val setSystemBarsAppearance: (Boolean) -> Unit,
) {
    internal fun openUrl(value: String) {
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

    internal fun requireStringParam(params: Any?, name: String): String {
        val value = (params as? JSONObject)?.opt(name)
        if (value !is String) {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "$name must be a string.",
            )
        }
        return value
    }

    internal fun requireFileBridge() = fileBridge ?: throw NativeBridgeException(
        "BRIDGE_UNAVAILABLE",
        "The Android file picker is not available.",
    )

    internal fun readTextFile(path: String, params: JSONObject?): String {
        if (params?.optString("baseDir") == "appLocalData") {
            return resolveAppDataFile(path).readText()
        }
        val uri = requireContentUri(path)
        return context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            ?: throw NativeBridgeException("BRIDGE_IO_ERROR", "The selected file could not be read.")
    }

    internal fun writeTextFile(path: String, contents: String, params: JSONObject?) {
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

    internal fun invokeSftpUpload(clientId: String, params: Any?): Any? {
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

    internal fun invokeSftpDownload(clientId: String, params: Any?): Any? {
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
        val EXTERNAL_SCHEMES = setOf("http", "https", "mailto", "tel")
    }
}
