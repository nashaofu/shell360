package com.nashaofu.shell360.feature.sftp

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Directory listings are held in memory so the SFTP interface is fully operable
 * before the transfer runtime is wired in; swapping [tree] for the bridge calls
 * leaves the screen unchanged.
 */
class SftpViewModel {
    var uiState: SftpUiState by mutableStateOf(SftpUiState())
        private set

    private val tree = mutableMapOf<String, MutableList<SftpEntry>>()

    init {
        uiState = uiState.copy(entries = computeEntries(uiState))
    }

    private fun directory(path: String): MutableList<SftpEntry> =
        tree.getOrPut(normalizeSftpPath(path)) { mutableListOf() }

    private fun computeEntries(state: SftpUiState): List<SftpEntry> {
        val keyword = state.query.trim().lowercase()
        val filtered = directory(state.path)
            .filter { state.showHiddenFiles || !it.name.startsWith(".") }
            .filter { keyword.isEmpty() || it.name.lowercase().contains(keyword) }
        val sorted = when (state.orderBy) {
            SftpSortColumn.Name -> filtered.sortedBy { it.name.lowercase() }
            SftpSortColumn.Size -> filtered.sortedBy { it.size }
        }
        return if (state.isDesc) sorted.reversed() else sorted
    }

    fun onAction(action: SftpAction) {
        uiState = when (action) {
            is SftpAction.PathChanged -> uiState.copy(pathDraft = action.value)
            SftpAction.PathEditingStarted -> uiState.copy(isPathEditing = true, pathDraft = uiState.path)
            SftpAction.PathEditingCancelled -> uiState.copy(isPathEditing = false, pathDraft = uiState.path)
            SftpAction.PathConfirmed -> {
                val target = normalizeSftpPath(uiState.pathDraft)
                uiState.copy(path = target, pathDraft = target, isPathEditing = false)
            }

            is SftpAction.NavigateTo -> {
                val target = normalizeSftpPath(action.path)
                uiState.copy(path = target, pathDraft = target, isPathEditing = false)
            }

            is SftpAction.QueryChanged -> uiState.copy(query = action.value)
            SftpAction.SearchToggled -> uiState.copy(isSearchVisible = !uiState.isSearchVisible, query = "")
            SftpAction.ToggleHiddenFiles -> uiState.copy(showHiddenFiles = !uiState.showHiddenFiles)
            is SftpAction.SortChanged -> {
                if (uiState.orderBy == action.column) {
                    uiState.copy(isDesc = !uiState.isDesc)
                } else {
                    uiState.copy(orderBy = action.column, isDesc = false)
                }
            }

            is SftpAction.EntryOpened -> {
                if (action.entry.isDir) {
                    uiState.copy(
                        path = normalizeSftpPath(action.entry.path),
                        pathDraft = normalizeSftpPath(action.entry.path),
                    )
                } else {
                    uiState.copy(
                        editingEntry = action.entry,
                        editingContent = action.entry.content,
                    )
                }
            }

            is SftpAction.DownloadRequested -> uiState.copy(
                feedbackMessage = "Downloading \"${action.entry.name}\" requires the SFTP runtime.",
            )

            is SftpAction.CreateStarted -> uiState.copy(
                creatingKind = action.kind,
                creatingValue = action.kind.label,
            )

            is SftpAction.CreateValueChanged -> uiState.copy(creatingValue = sanitizeSftpFilename(action.value))
            SftpAction.CreateCancelled -> uiState.copy(creatingKind = null, creatingValue = "")
            SftpAction.CreateConfirmed -> {
                val kind = uiState.creatingKind
                val name = uiState.creatingValue.trim()
                if (kind == null || name.isEmpty()) uiState.copy(creatingKind = null, creatingValue = "")
                else {
                    val dir = normalizeSftpPath(uiState.path)
                    val path = if (dir == "/") "/$name" else "$dir/$name"
                    directory(dir).removeAll { it.name == name }
                    directory(dir).add(SftpEntry(name = name, path = path, isDir = kind == CreateKind.Dir,
                        permissions = if (kind == CreateKind.Dir) "drwxr-xr-x" else "-rw-r--r--"))
                    uiState.copy(creatingKind = null, creatingValue = "",
                        feedbackMessage = "Created local preview \"$name\"; SFTP runtime is not connected.")
                }
            }

            is SftpAction.RenameStarted -> uiState.copy(
                renamingPath = action.entry.path,
                renamingValue = action.entry.name,
            )

            is SftpAction.RenameValueChanged -> uiState.copy(
                renamingValue = sanitizeSftpFilename(action.value),
            )

            SftpAction.RenameCancelled -> uiState.copy(renamingPath = null, renamingValue = "")
            SftpAction.RenameConfirmed -> {
                val targetPath = uiState.renamingPath
                val name = uiState.renamingValue.trim()
                if (targetPath == null || name.isEmpty()) {
                    uiState.copy(renamingPath = null, renamingValue = "")
                } else {
                    val dir = normalizeSftpPath(uiState.path)
                    val list = directory(dir)
                    val index = list.indexOfFirst { it.path == targetPath }
                    if (index >= 0) list[index] = list[index].copy(name = name,
                        path = if (dir == "/") "/$name" else "$dir/$name")
                    uiState.copy(
                        renamingPath = null,
                        renamingValue = "",
                        feedbackMessage = "Renamed local preview \"$name\"; SFTP runtime is not connected.",
                    )
                }
            }

            is SftpAction.DeleteRequested -> uiState.copy(deleteTarget = action.entry)
            SftpAction.DeleteDismissed -> uiState.copy(deleteTarget = null)
            SftpAction.DeleteConfirmed -> {
                val target = uiState.deleteTarget
                if (target != null) {
                    directory(uiState.path).removeAll { it.path == target.path }
                    uiState.copy(
                        deleteTarget = null,
                        feedbackMessage = "Removed local preview \"${target.name}\"; SFTP runtime is not connected.",
                    )
                } else {
                    uiState
                }
            }

            SftpAction.EditorClosed -> uiState.copy(editingEntry = null, editingContent = "")
            is SftpAction.EditorContentChanged -> uiState.copy(editingContent = action.value)
            SftpAction.EditorSaved -> {
                val target = uiState.editingEntry
                if (target == null) {
                    uiState
                } else {
                    val list = directory(uiState.path)
                    val index = list.indexOfFirst { it.path == target.path }
                    if (index >= 0) list[index] = list[index].copy(content = uiState.editingContent,
                        size = uiState.editingContent.toByteArray().size.toLong())
                    uiState.copy(
                        editingEntry = null,
                        editingContent = "",
                        feedbackMessage = "Saved local preview \"${target.name}\"; SFTP runtime is not connected.",
                    )
                }
            }

            SftpAction.RefreshRequested -> uiState.copy(feedbackMessage = "Folder refreshed")
            SftpAction.UploadRequested -> uiState.copy(
                feedbackMessage = "Uploading files requires the SFTP runtime.",
            )

            SftpAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
            is SftpAction.Feedback -> uiState.copy(feedbackMessage = action.message)
        }

        uiState = uiState.copy(entries = computeEntries(uiState))
    }

    fun replaceDirectory(path: String, entries: List<SftpEntry>) {
        val normalized = normalizeSftpPath(path)
        tree[normalized] = entries.toMutableList()
        uiState = uiState.copy(path = normalized, pathDraft = normalized, entries = computeEntries(uiState.copy(path = normalized)))
    }
}
