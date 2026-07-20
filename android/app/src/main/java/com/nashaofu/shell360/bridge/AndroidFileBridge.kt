package com.nashaofu.shell360.bridge

import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicReference

class AndroidFileBridge(private val activity: ComponentActivity) {
    private val pendingOpen = AtomicReference<CompletableFuture<String?>?>()
    private val pendingSave = AtomicReference<CompletableFuture<String?>?>()

    private val openDocument = activity.registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        pendingOpen.getAndSet(null)?.complete(uri?.also(::persistReadPermission)?.toString())
    }

    private val createDocument = activity.registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        pendingSave.getAndSet(null)?.complete(uri?.also(::persistWritePermission)?.toString())
    }

    fun open(): String? {
        val future = CompletableFuture<String?>()
        if (!pendingOpen.compareAndSet(null, future)) {
            throw NativeBridgeException("BRIDGE_BUSY", "A file picker is already open.")
        }
        activity.runOnUiThread {
            try {
                openDocument.launch(arrayOf("*/*"))
            } catch (error: Exception) {
                pendingOpen.getAndSet(null)?.completeExceptionally(error)
            }
        }
        return future.get()
    }

    fun save(filename: String): String? {
        val future = CompletableFuture<String?>()
        if (!pendingSave.compareAndSet(null, future)) {
            throw NativeBridgeException("BRIDGE_BUSY", "A file picker is already open.")
        }
        activity.runOnUiThread {
            try {
                createDocument.launch(filename)
            } catch (error: Exception) {
                pendingSave.getAndSet(null)?.completeExceptionally(error)
            }
        }
        return future.get()
    }

    fun dispose() {
        val error = NativeBridgeException("BRIDGE_DISPOSED", "The file picker was closed.")
        pendingOpen.getAndSet(null)?.completeExceptionally(error)
        pendingSave.getAndSet(null)?.completeExceptionally(error)
    }

    private fun persistReadPermission(uri: Uri) {
        runCatching {
            activity.contentResolver.takePersistableUriPermission(
                uri,
                android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        }
    }

    private fun persistWritePermission(uri: Uri) {
        runCatching {
            activity.contentResolver.takePersistableUriPermission(
                uri,
                android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
        }
    }
}
