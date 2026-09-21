package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape
import com.nashaofu.shell360.terminal.NativeRuntimeClient
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

data class NativeSftpFile(val path: String, val name: String, val type: String, val size: Long)

class NativeSftpSession(private val runtime: NativeRuntimeClient, private val sshSessionId: String, private val onRemoteClose: () -> Unit = {}) {
    val id = UUID.randomUUID().toString()
    private var removeEof: (() -> Unit)? = null
    private var removeClose: (() -> Unit)? = null
    private val closed = AtomicBoolean(false)
    init {
        removeEof = runtime.onEvent("ssh.sftp.eof", id) { handleRemoteClose() }
        removeClose = runtime.onEvent("ssh.sftp.close", id) { handleRemoteClose() }
    }
    fun open(done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.open", JSONObject().put("sshSessionId", sshSessionId).put("sshSftpId", id)) { done(it.result()) }
    fun readDir(path: String, done: (Result<List<NativeSftpFile>>) -> Unit) = runtime.request("ssh.sftp.readDir", JSONObject().put("sshSftpId", id).put("path", path)) { response ->
        done(if (response.has("error")) Result.failure(response.toRuntimeError()) else runCatching { response.getJSONArray("data").toFiles() })
    }
    fun close() {
        if (!closed.compareAndSet(false, true)) return
        removeEof?.invoke()
        removeClose?.invoke()
        removeEof = null
        removeClose = null
        runtime.request("ssh.sftp.close", JSONObject().put("sshSftpId", id)) {}
    }
    private fun handleRemoteClose() {
        if (closed.compareAndSet(false, true)) {
            removeEof?.invoke()
            removeClose?.invoke()
            removeEof = null
            removeClose = null
            onRemoteClose()
        }
    }
    fun createDir(path: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.createDir", JSONObject().put("sshSftpId", id).put("path", path)) { done(it.result()) }
    fun createFile(path: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.createFile", JSONObject().put("sshSftpId", id).put("path", path)) { done(it.result()) }
    fun removeFile(path: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.removeFile", JSONObject().put("sshSftpId", id).put("path", path)) { done(it.result()) }
    fun removeDir(path: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.removeDir", JSONObject().put("sshSftpId", id).put("path", path)) { done(it.result()) }
    fun rename(from: String, to: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.rename", JSONObject().put("sshSftpId", id).put("oldPath", from).put("newPath", to)) { done(it.result()) }
    fun readText(path: String, done: (Result<String>) -> Unit) = runtime.request("ssh.sftp.readTextFile", JSONObject().put("sshSftpId", id).put("path", path)) { r -> done(if (r.has("error")) Result.failure(r.toRuntimeError()) else Result.success(r.optString("data"))) }
    fun writeText(path: String, content: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.writeTextFile", JSONObject().put("sshSftpId", id).put("path", path).put("content", content)) { done(it.result()) }
    fun upload(local: String, remote: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.uploadFile", JSONObject().put("sshSftpId", id).put("localFilename", local).put("remoteFilename", remote)) { done(it.result()) }
    fun download(remote: String, local: String, done: (Result<Unit>) -> Unit) = runtime.request("ssh.sftp.downloadFile", JSONObject().put("sshSftpId", id).put("localFilename", local).put("remoteFilename", remote)) { done(it.result()) }
}

private fun JSONArray.toFiles() = buildList { for (i in 0 until length()) { val v = getJSONObject(i); add(NativeSftpFile(v.optString("path"), v.optString("name"), v.optString("fileType"), v.optLong("size"))) } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SftpScreen(session: NativeSftpSession, onBack: () -> Unit, onOpenDrawer: (() -> Unit)? = null, onShowSessions: (() -> Unit)? = null, onCloseSession: (() -> Unit)? = null) {
    val context = LocalContext.current
    val transfer = remember { ContentFileTransfer(context) }
    var path by remember { mutableStateOf(".") }
    var files by remember { mutableStateOf<List<NativeSftpFile>>(emptyList()) }
    var error by remember { mutableStateOf("") }
    var confirmClose by remember { mutableStateOf(false) }
    var editor by remember { mutableStateOf<Pair<String, String>?>(null) }
    var editorOriginal by remember { mutableStateOf<String?>(null) }
    var confirmEditorClose by remember { mutableStateOf(false) }
    var remotePath by remember { mutableStateOf("") }
    var pendingDownloadRemote by remember { mutableStateOf("") }
    var selectedPath by remember { mutableStateOf<String?>(null) }
    var selectionMode by remember { mutableStateOf(false) }
    var selectedPaths by remember { mutableStateOf<Set<String>>(emptySet()) }
    var newName by remember { mutableStateOf("") }
    var keyword by remember { mutableStateOf("") }
    var showMore by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<NativeSftpFile?>(null) }
    var transferState by remember { mutableStateOf<String?>(null) }
    var transferDetail by remember { mutableStateOf("") }
    var transferCancelled by remember { mutableStateOf(false) }
    var transferPaused by remember { mutableStateOf(false) }
    var resumeTransfer: (() -> Unit)? by remember { mutableStateOf(null) }
    var retryUploadUris by remember { mutableStateOf<List<android.net.Uri>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    fun refresh() {
        loading = true
        session.readDir(path) { result ->
            result.fold(
                { files = it; error = "" },
                { error = it.message ?: "SFTP failed" },
            )
            loading = false
        }
    }
    fun openSftp() {
        loading = true
        session.open { result ->
            result.onSuccess { refresh() }
                .onFailure { error = it.message ?: "SFTP open failed"; loading = false }
        }
    }
    fun uploadFiles(uris: List<android.net.Uri>) {
        if (uris.isNotEmpty()) {
            retryUploadUris = uris
            transferState = "Queued"
            transferDetail = "${uris.size} file(s) queued"
            transferCancelled = false
            transferPaused = false
            fun uploadAt(index: Int) {
                if (transferCancelled) return
                if (transferPaused) {
                    transferState = "Paused"
                    resumeTransfer = { uploadAt(index) }
                    return
                }
                if (index == uris.size) {
                    transferState = "Completed"
                    transferDetail = "Uploaded ${uris.size} file(s)"
                    refresh()
                    return
                }
                val uri = uris[index]
                val filename = uri.lastPathSegment?.substringAfterLast('/') ?: "upload-${index + 1}"
                val destination = remotePath.ifBlank { "$path/$filename" }
                transferState = "Running"
                transferDetail = "${filename} · ${index + 1}/${uris.size}"
                runCatching { transfer.stageForUpload(uri, filename) }
                    .fold({ staged -> session.upload(staged.absolutePath, destination) { result ->
                        staged.delete()
                        result.onSuccess { uploadAt(index + 1) }
                            .onFailure { error = it.message ?: "Upload failed"; transferState = "Failed"; transferDetail = filename }
                    } }, { error = it.message ?: "Cannot read selected file"; transferState = "Failed"; transferDetail = filename })
            }
            uploadAt(0)
        }
    }
    val uploadPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> uploadFiles(uris) }
    val downloadPicker = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri != null) {
            if (pendingDownloadRemote.isBlank()) {
                error = "Remote path is required"
                return@rememberLauncherForActivityResult
            }
            val temp = transfer.createDownloadFile(pendingDownloadRemote.substringAfterLast('/'))
            session.download(pendingDownloadRemote, temp.absolutePath) { result ->
                result.onSuccess { runCatching { transfer.exportDownloadedFile(temp, uri) }.onFailure { error = it.message ?: "Cannot save file" } }
                    .onFailure { error = it.message ?: "Download failed" }
                temp.delete()
            }
        }
    }
    val pathParts = remember(path) {
        path.split('/').filter { it.isNotBlank() }.fold(mutableListOf("/")) { parts, part ->
            parts += if (parts.last() == ".") "/$part" else "${parts.last()}/$part"
            parts
        }
    }
    LaunchedEffect(Unit) { openSftp() }
    BackHandler(enabled = selectionMode) {
        selectionMode = false
        selectedPaths = emptySet()
    }
    deleteTarget?.let { target ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete ${target.name}?") },
            text = { Text("This remote ${if (target.type == "Dir") "folder" else "file"} will be permanently removed.") },
            confirmButton = {
                Button(onClick = {
                    val done: (Result<Unit>) -> Unit = { result ->
                        result.onSuccess { selectedPath = null; refresh() }
                            .onFailure { error = it.message ?: "Delete failed" }
                    }
                    if (target.type == "Dir") session.removeDir(target.path, done) else session.removeFile(target.path, done)
                    deleteTarget = null
                }) { Text("Delete") }
            },
            dismissButton = { Button(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }
    if (confirmClose) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmClose = false },
            title = { Text("Close session?") },
            text = { Text("The live SFTP session will be disconnected and removed from Workspace.") },
            confirmButton = { Button(onClick = { confirmClose = false; onCloseSession?.invoke() }) { Text("Close session") } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { confirmClose = false }) { Text("Cancel") } },
        )
    }
    if (confirmEditorClose) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirmEditorClose = false },
            title = { Text("Discard unsaved changes?") },
            text = { Text("Your edits to the remote file will be lost.") },
            confirmButton = { Button(onClick = { confirmEditorClose = false; editor = null; editorOriginal = null }) { Text("Discard") } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { confirmEditorClose = false }) { Text("Keep editing") } },
        )
    }
    Scaffold(topBar = { NativeTopBar("SFTP", onBack = onBack, onOpenDrawer = onOpenDrawer) {
        onShowSessions?.let { show ->
            IconButton(onClick = show, modifier = Modifier.size(44.dp)) {
                androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_menu), "Sessions", Modifier.size(20.dp))
            }
        }
        onCloseSession?.let { close ->
            IconButton(onClick = { confirmClose = true }, modifier = Modifier.size(44.dp)) {
                androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_close), "Disconnect", Modifier.size(20.dp))
            }
        }
    } }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (error.isNotBlank()) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(error, color = androidx.compose.material3.MaterialTheme.colorScheme.error, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
                    Button(onClick = { error = ""; openSftp() }, modifier = Modifier.height(40.dp), shape = RoundedCornerShape(10.dp)) { Text("Retry") }
                }
            }
            Row(
                Modifier.fillMaxWidth().height(52.dp).padding(horizontal = 12.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Row(Modifier.weight(1f).horizontalScroll(rememberScrollState()), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    pathParts.forEachIndexed { index, part ->
                        if (index > 0) {
                            Text("/", color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 2.dp))
                        }
                        Text(
                            part.substringAfterLast('/').ifBlank { "/" },
                            Modifier
                                    .clickable {
                                    loading = true
                                    val target = if (part == "/") "." else part
                                    path = target
                                    session.readDir(target) { result ->
                                        result.fold(
                                            { files = it; error = "" },
                                            { error = it.message ?: "SFTP failed" },
                                        )
                                        loading = false
                                    }
                                }
                                .padding(horizontal = 4.dp, vertical = 6.dp),
                            maxLines = 1,
                            style = androidx.compose.material3.MaterialTheme.typography.bodyMedium.copy(
                                fontSize = 14.sp,
                                fontWeight = if (index == pathParts.lastIndex) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal,
                            ),
                        )
                    }
                }
                IconButton(onClick = { refresh() }, modifier = Modifier.size(30.dp)) {
                    androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_refresh), "Refresh current folder", Modifier.size(18.dp))
                }
            }
            androidx.compose.material3.HorizontalDivider(color = androidx.compose.material3.MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                NativeCompactField(keyword, { keyword = it }, "Search files", Modifier.weight(1f), com.nashaofu.shell360.R.drawable.ic_search, { keyword = "" }, fieldHeight = 44.dp)
                IconButton(onClick = { uploadPicker.launch(arrayOf("*/*")) }, modifier = Modifier.size(44.dp)) {
                    androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_upload), "Upload files", Modifier.size(18.dp))
                }
            }
            transferState?.let { state ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(state, color = if (state == "Failed") androidx.compose.material3.MaterialTheme.colorScheme.error else androidx.compose.material3.MaterialTheme.colorScheme.primary)
                        Text(transferDetail, style = androidx.compose.material3.MaterialTheme.typography.bodySmall, color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (state == "Running" || state == "Queued") {
                        androidx.compose.material3.TextButton(onClick = { transferPaused = true; transferState = "Paused"; transferDetail = "Transfer paused" }) { Text("Pause") }
                        androidx.compose.material3.TextButton(onClick = { transferCancelled = true; transferState = "Cancelled"; transferDetail = "Transfer cancelled" }) { Text("Cancel") }
                    }
                    if (state == "Paused") {
                        androidx.compose.material3.TextButton(onClick = { transferPaused = false; resumeTransfer?.invoke() }) { Text("Resume") }
                        androidx.compose.material3.TextButton(onClick = { transferCancelled = true; transferState = "Cancelled"; transferDetail = "Transfer cancelled" }) { Text("Cancel") }
                    }
                    if (state == "Failed" && retryUploadUris.isNotEmpty()) {
                        androidx.compose.material3.TextButton(onClick = { uploadFiles(retryUploadUris) }) { Text("Retry") }
                    }
                }
            }
            if (showMore) {
                NativeCompactField(remotePath, { remotePath = it }, "Remote path", Modifier.padding(horizontal = 8.dp))
                NativeCompactField(newName, { newName = it }, "New name")
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.End) {
                if (selectionMode) {
                    Text("${selectedPaths.size} selected", modifier = Modifier.weight(1f).padding(start = 8.dp), color = androidx.compose.material3.MaterialTheme.colorScheme.primary)
                    androidx.compose.material3.TextButton(onClick = { selectionMode = false; selectedPaths = emptySet() }) { Text("Done") }
                }
                Box {
                    IconButton(onClick = { showMore = true }, modifier = Modifier.size(32.dp)) {
                        androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_more), "Open file actions", Modifier.size(18.dp))
                    }
                    DropdownMenu(expanded = showMore, onDismissRequest = { showMore = false }) {
                        DropdownMenuItem(text = { Text("Up") }, enabled = path != ".", onClick = { path = path.substringBeforeLast('/', ".").ifBlank { "." }; showMore = false; refresh() })
                        DropdownMenuItem(text = { Text(if (selectionMode) "Exit selection" else "Select multiple") }, onClick = { selectionMode = !selectionMode; selectedPaths = emptySet(); showMore = false })
                        DropdownMenuItem(text = { Text("Download") }, enabled = remotePath.isNotBlank(), onClick = { pendingDownloadRemote = remotePath; downloadPicker.launch(remotePath.substringAfterLast('/').ifBlank { "download" }); showMore = false })
                        DropdownMenuItem(text = { Text("New folder") }, onClick = { if (newName.isNotBlank()) session.createDir("$path/${newName.trim()}") { result -> result.onSuccess { newName = ""; refresh() }.onFailure { error = it.message ?: "Create directory failed" } }; showMore = false })
                        DropdownMenuItem(text = { Text("New file") }, onClick = { if (newName.isNotBlank()) session.createFile("$path/${newName.trim()}") { result -> result.onSuccess { newName = ""; refresh() }.onFailure { error = it.message ?: "Create file failed" } }; showMore = false })
                        DropdownMenuItem(text = { Text("Rename") }, enabled = selectedPath != null && newName.isNotBlank(), onClick = { selectedPath?.let { target -> val destination = target.substringBeforeLast('/') + "/" + newName.trim(); session.rename(target, destination) { result -> result.onSuccess { selectedPath = destination; newName = ""; refresh() }.onFailure { error = it.message ?: "Rename failed" } } }; showMore = false })
                        DropdownMenuItem(text = { Text("Delete") }, enabled = selectedPath != null, onClick = { deleteTarget = files.firstOrNull { it.path == selectedPath }; showMore = false })
                        DropdownMenuItem(text = { Text("Refresh") }, onClick = { showMore = false; refresh() })
                    }
                }
            }
            val visibleFiles = files.filter { keyword.isBlank() || it.name.contains(keyword, ignoreCase = true) }
            if (loading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (visibleFiles.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    Text(if (keyword.isBlank()) "This folder is empty" else "No files match your search", color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
                items(visibleFiles, key = { it.path }) { file ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(60.dp)
                            .clickable {
                                if (selectionMode) {
                                    selectedPaths = if (file.path in selectedPaths) selectedPaths - file.path else selectedPaths + file.path
                                    selectedPath = file.path
                                } else {
                                    selectedPath = file.path
                                    if (file.type == "Dir") {
                                        path = file.path
                                        refresh()
                                    } else {
                                        session.readText(file.path) { it.onSuccess { text -> editorOriginal = text; editor = file.path to text }.onFailure { error = it.message ?: "Open file failed" } }
                                    }
                                }
                            }
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    ) {
                        Text(
                            if (file.type == "Dir") "▰" else "□",
                            color = androidx.compose.material3.MaterialTheme.colorScheme.primary,
                            style = androidx.compose.material3.MaterialTheme.typography.bodyLarge.copy(fontSize = 22.sp),
                        )
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(file.name, maxLines = 1, style = androidx.compose.material3.MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium))
                            Text(if (file.type == "Dir") "Folder" else "${file.size} B", color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant, style = androidx.compose.material3.MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp))
                        }
                        IconButton(onClick = { selectedPath = file.path; showMore = true }, modifier = Modifier.size(40.dp)) {
                            androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_more), "More actions", Modifier.size(18.dp))
                        }
                    }
                    androidx.compose.material3.HorizontalDivider(color = androidx.compose.material3.MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(start = 56.dp))
                }
            }
        }
    }
    editor?.let { (filePath, content) ->
        val requestEditorClose = {
            if (content != editorOriginal) confirmEditorClose = true else { editor = null; editorOriginal = null }
        }
        NativePageDrawer(onDismissRequest = requestEditorClose) {
            androidx.compose.material3.Surface(
                modifier = Modifier.fillMaxSize(),
                tonalElevation = 0.dp,
            ) {
                Column(Modifier.fillMaxSize()) {
                    Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 12.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text(filePath.substringAfterLast('/'), modifier = Modifier.weight(1f), style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                        IconButton(onClick = requestEditorClose, modifier = Modifier.size(40.dp)) { androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.nashaofu.shell360.R.drawable.ic_close), "Close file editor", Modifier.size(20.dp)) }
                    }
                    androidx.compose.material3.HorizontalDivider()
                    androidx.compose.material3.OutlinedTextField(content, { value -> editor = filePath to value }, Modifier.fillMaxWidth().weight(1f).padding(12.dp), minLines = 8)
                    androidx.compose.material3.HorizontalDivider()
                    Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.End, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Button(onClick = requestEditorClose, shape = RoundedCornerShape(10.dp), modifier = Modifier.height(44.dp)) { Text("Cancel") }
                        Button(onClick = { session.writeText(filePath, editor?.second.orEmpty()) { result -> result.onSuccess { editor = null; editorOriginal = null }.onFailure { error = it.message ?: "Save failed" } } }, shape = RoundedCornerShape(10.dp), modifier = Modifier.height(44.dp).padding(start = 8.dp)) { Text("Save") }
                    }
                }
            }
        }
    }
}
