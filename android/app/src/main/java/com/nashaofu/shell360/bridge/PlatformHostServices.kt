package com.nashaofu.shell360.bridge

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.nashaofu.shell360.BuildConfig
import com.nashaofu.shell360.ffi.HostServices
import java.io.File
import java.util.UUID
import org.json.JSONObject
import org.json.JSONTokener

class PlatformHostServices(
    private val context: Context,
    private val fileBridge: AndroidFileBridge?,
    private val closeWindow: () -> Unit,
    private val resetApplication: () -> Unit,
    private val setSystemBarsAppearance: (Boolean) -> Unit,
) : HostServices {
    @Volatile
    private var completion: ((String, String) -> Unit)? = null

    fun attachCompletion(completion: (String, String) -> Unit) {
        this.completion = completion
    }

    fun detachCompletion() {
        completion = null
    }

    override fun onHostCall(callId: String, primitive: String, paramsJson: String) {
        val result = try {
            hostSuccess(execute(primitive, parseParams(paramsJson)))
        } catch (error: NativeBridgeException) {
            hostFailure(error.code, error.message, error.details)
        } catch (error: Exception) {
            hostFailure(
                "JSB_NATIVE_ERROR",
                error.message ?: "Android HostServices call failed.",
            )
        }
        completion?.invoke(callId, result)
    }

    private fun execute(primitive: String, params: JSONObject): Any? {
        return when (primitive) {
            "getAppVersion" -> BuildConfig.VERSION_NAME
            "getMachineUid" -> getMachineUid()
            "setSystemBarsAppearance" -> {
                setSystemBarsAppearance(requireBoolean(params, "dark"))
                null
            }
            "readClipboard" -> readClipboard()
            "writeClipboard" -> {
                writeClipboard(requireString(params, "text"))
                null
            }
            "openExternal" -> {
                openExternal(requireString(params, "url"))
                null
            }
            "pickDocuments" -> requireFileBridge().open()
            "saveDocument" -> requireFileBridge().save(
                params.optString("defaultPath").takeIf(String::isNotBlank) ?: "shell360.json",
            )
            "readTextFile" -> readTextFile(params)
            "writeTextFile" -> {
                writeTextFile(params)
                null
            }
            "closeWindow" -> {
                closeWindow()
                null
            }
            "readScopedFile" -> {
                readScopedFile(params)
                null
            }
            "writeScopedFile" -> {
                writeScopedFile(params)
                null
            }
            "resetApplication" -> {
                resetApplication()
                null
            }
            else -> throw NativeBridgeException(
                "BRIDGE_UNSUPPORTED",
                "Android HostServices primitive is unavailable: $primitive",
            )
        }
    }

    private fun getMachineUid(): String {
        val preferences = context.getSharedPreferences("shell360-platform", Context.MODE_PRIVATE)
        return preferences.getString("machine_uid", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("machine_uid", it).apply()
        }
    }

    private fun readClipboard(): String {
        return context.getSystemService(ClipboardManager::class.java)
            .primaryClip
            ?.takeIf { it.itemCount > 0 }
            ?.getItemAt(0)
            ?.coerceToText(context)
            ?.toString()
            .orEmpty()
    }

    private fun writeClipboard(text: String) {
        context.getSystemService(ClipboardManager::class.java)
            .setPrimaryClip(ClipData.newPlainText("Shell360", text))
    }

    private fun openExternal(value: String) {
        val uri = Uri.parse(value)
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

    private fun readTextFile(params: JSONObject): String {
        val path = requireString(params, "path")
        if (params.optString("baseDir") == "appLocalData") {
            return resolveAppDataFile(path).readText()
        }
        return context.contentResolver.openInputStream(requireContentUri(path))
            ?.bufferedReader()
            ?.use { it.readText() }
            ?: throw NativeBridgeException(
                "BRIDGE_IO_ERROR",
                "The selected file could not be read.",
            )
    }

    private fun writeTextFile(params: JSONObject) {
        val path = requireString(params, "path")
        val contents = requireString(params, "contents")
        if (params.optString("baseDir") == "appLocalData") {
            val file = resolveAppDataFile(path)
            file.parentFile?.mkdirs()
            file.writeText(contents)
            return
        }
        context.contentResolver.openOutputStream(requireContentUri(path), "wt")
            ?.bufferedWriter()
            ?.use { it.write(contents) }
            ?: throw NativeBridgeException(
                "BRIDGE_IO_ERROR",
                "The selected file could not be written.",
            )
    }

    private fun readScopedFile(params: JSONObject) {
        val source = requireContentUri(requireString(params, "source"))
        val target = requireStagingFile(requireString(params, "targetPath"))
        context.contentResolver.openInputStream(source)?.use { input ->
            target.outputStream().use(input::copyTo)
        } ?: throw NativeBridgeException(
            "BRIDGE_IO_ERROR",
            "The selected upload file could not be read.",
        )
    }

    private fun writeScopedFile(params: JSONObject) {
        val source = requireStagingFile(requireString(params, "sourcePath"))
        val target = requireContentUri(requireString(params, "target"))
        context.contentResolver.openOutputStream(target, "wt")?.use { output ->
            source.inputStream().use { input -> input.copyTo(output) }
        } ?: throw NativeBridgeException(
            "BRIDGE_IO_ERROR",
            "The selected download destination could not be written.",
        )
    }

    private fun resolveAppDataFile(path: String): File {
        val root = context.filesDir.resolve("shell360").canonicalFile
        val file = root.resolve(path).canonicalFile
        if (file != root && !file.toPath().startsWith(root.toPath())) {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "The app data path is invalid.",
            )
        }
        return file
    }

    private fun requireStagingFile(path: String): File {
        val root = context.cacheDir.resolve("shell360/transfers").canonicalFile
        val file = File(path).canonicalFile
        if (!file.toPath().startsWith(root.toPath())) {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "The staging path is outside the managed transfer directory.",
            )
        }
        file.parentFile?.mkdirs()
        return file
    }

    private fun requireContentUri(path: String): Uri {
        val uri = Uri.parse(path)
        if (uri.scheme != "content") {
            throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "Android scoped file access requires a content URI.",
            )
        }
        return uri
    }

    private fun requireFileBridge(): AndroidFileBridge {
        return fileBridge ?: throw NativeBridgeException(
            "BRIDGE_UNAVAILABLE",
            "The Android file picker is not available.",
        )
    }

    private fun requireString(params: JSONObject, name: String): String {
        return params.opt(name) as? String
            ?: throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "$name must be a string.",
            )
    }

    private fun requireBoolean(params: JSONObject, name: String): Boolean {
        return params.opt(name) as? Boolean
            ?: throw NativeBridgeException(
                "BRIDGE_INVALID_REQUEST",
                "$name must be a boolean.",
            )
    }

    private fun parseParams(paramsJson: String): JSONObject {
        val value = JSONTokener(paramsJson).nextValue()
        return value as? JSONObject ?: JSONObject()
    }

    private fun hostSuccess(data: Any?): String {
        return JSONObject()
            .put("data", data?.let(JSONObject::wrap) ?: JSONObject.NULL)
            .toString()
    }

    private fun hostFailure(code: String, message: String, details: Any? = null): String {
        val error = JSONObject()
            .put("code", code)
            .put("message", message)
        if (details != null) {
            error.put("details", JSONObject.wrap(details))
        }
        return JSONObject().put("error", error).toString()
    }
}
