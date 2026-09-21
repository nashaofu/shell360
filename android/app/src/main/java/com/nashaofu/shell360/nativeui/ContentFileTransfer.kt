package com.nashaofu.shell360.nativeui

import android.content.Context
import android.net.Uri
import java.io.File

/** Converts Storage Access Framework content URIs to bounded app-local files. */
class ContentFileTransfer(private val context: Context) {
    fun createDownloadFile(filename: String): File = safeTarget(filename)

    fun stageForUpload(uri: Uri, filename: String): File {
        val target = safeTarget(filename)
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Unable to open selected file." }
            target.outputStream().use { output -> input.copyTo(output) }
        }
        return target
    }

    fun exportDownloadedFile(source: File, uri: Uri) {
        source.inputStream().use { input ->
            context.contentResolver.openOutputStream(uri).use { output ->
                requireNotNull(output) { "Unable to open destination file." }
                input.copyTo(output)
            }
        }
    }

    private fun safeTarget(filename: String): File {
        val directory = File(context.cacheDir, "sftp-transfer").apply { mkdirs() }
        val safeName = filename.substringAfterLast('/').substringAfterLast('\\').ifBlank { "transfer.bin" }
        return File(directory, safeName).canonicalFile.also { target ->
            require(target.parentFile == directory.canonicalFile) { "Invalid transfer filename." }
        }
    }
}
