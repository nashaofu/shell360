package com.nashaofu.shell360.feature.sftp

import java.util.Locale

data class SftpEntry(
    val name: String,
    val path: String,
    val isDir: Boolean,
    val isSymlink: Boolean = false,
    val size: Long = 0L,
    val mtime: Long = System.currentTimeMillis() / 1000,
    val permissions: String = "-rw-r--r--",
    val content: String = "",
) {
    val displaySize: String get() = if (isDir) "-" else formatSize(size)
}

/** Mirrors the counts shown by the reference `StatusBar`. */
data class SftpTransferSummary(
    val uploading: Int = 0,
    val downloading: Int = 0,
    val completed: Int = 0,
)

enum class SftpSortColumn(val label: String) { Name("Name"), Size("Size") }

enum class CreateKind(val label: String) { File("New File"), Dir("New Folder") }

data class SftpUiState(
    val path: String = "/",
    val pathDraft: String = "/",
    val isPathEditing: Boolean = false,
    val isSearchVisible: Boolean = false,
    val query: String = "",
    val showHiddenFiles: Boolean = false,
    val orderBy: SftpSortColumn = SftpSortColumn.Name,
    val isDesc: Boolean = false,
    val entries: List<SftpEntry> = emptyList(),
    val creatingKind: CreateKind? = null,
    val creatingValue: String = "",
    val renamingPath: String? = null,
    val renamingValue: String = "",
    val deleteTarget: SftpEntry? = null,
    val editingEntry: SftpEntry? = null,
    val editingContent: String = "",
    val transfer: SftpTransferSummary = SftpTransferSummary(),
    val feedbackMessage: String? = null,
)

fun normalizeSftpPath(path: String): String {
    val trimmed = path.trim().ifEmpty { "/" }
    val withRoot = if (trimmed.startsWith("/")) trimmed else "/$trimmed"
    val segments = withRoot.split("/").filter { it.isNotEmpty() && it != "." }
    val stack = ArrayDeque<String>()
    for (segment in segments) {
        if (segment == "..") {
            if (stack.isNotEmpty()) stack.removeLast()
        } else {
            stack.addLast(segment)
        }
    }
    return "/" + stack.joinToString("/")
}

fun sftpDirname(path: String): String {
    val normalized = normalizeSftpPath(path)
    val index = normalized.lastIndexOf('/')
    return if (index <= 0) "/" else normalized.substring(0, index)
}

/** Mirrors `sanitizeSftpFilename`: both separators are stripped, not just "/". */
fun sanitizeSftpFilename(value: String): String =
    value.replace("\\", "").replace("/", "").replace("\u0000", "")

fun formatSize(size: Long): String = when {
    size < 1024 -> "$size B"
    size < 1024L * 1024 -> "${round2(size / 1024.0)} KB"
    size < 1024L * 1024 * 1024 -> "${round2(size / (1024.0 * 1024))} MB"
    size < 1024L * 1024 * 1024 * 1024 -> "${round2(size / (1024.0 * 1024 * 1024))} GB"
    else -> "${round2(size / (1024.0 * 1024 * 1024 * 1024))} TB"
}

fun formatSftpMtime(mtime: Long): String {
    val format = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
    return format.format(java.util.Date(mtime * 1000))
}

private fun round2(value: Double): String = String.format(Locale.US, "%.2f", value)
