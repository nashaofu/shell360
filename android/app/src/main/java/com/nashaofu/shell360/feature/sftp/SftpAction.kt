package com.nashaofu.shell360.feature.sftp

sealed interface SftpAction {
    data class PathChanged(val value: String) : SftpAction
    data object PathEditingStarted : SftpAction
    data object PathEditingCancelled : SftpAction
    data object PathConfirmed : SftpAction
    data class NavigateTo(val path: String) : SftpAction
    data class QueryChanged(val value: String) : SftpAction
    data object SearchToggled : SftpAction
    data object ToggleHiddenFiles : SftpAction
    data class SortChanged(val column: SftpSortColumn) : SftpAction
    data class EntryOpened(val entry: SftpEntry) : SftpAction
    data class DownloadRequested(val entry: SftpEntry) : SftpAction
    data class CreateStarted(val kind: CreateKind) : SftpAction
    data class CreateValueChanged(val value: String) : SftpAction
    data object CreateCancelled : SftpAction
    data object CreateConfirmed : SftpAction
    data class RenameStarted(val entry: SftpEntry) : SftpAction
    data class RenameValueChanged(val value: String) : SftpAction
    data object RenameCancelled : SftpAction
    data object RenameConfirmed : SftpAction
    data class DeleteRequested(val entry: SftpEntry) : SftpAction
    data object DeleteDismissed : SftpAction
    data object DeleteConfirmed : SftpAction
    data object EditorClosed : SftpAction
    data class EditorContentChanged(val value: String) : SftpAction
    data object EditorSaved : SftpAction
    data object RefreshRequested : SftpAction
    data object UploadRequested : SftpAction
    data object FeedbackDismissed : SftpAction
    data class Feedback(val message: String) : SftpAction
}
