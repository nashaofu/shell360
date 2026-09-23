package com.nashaofu.shell360.feature.sftp

sealed interface SftpAction {
    data class QueryChanged(val value: String) : SftpAction
    data class PathChanged(val value: String) : SftpAction
    data object NavigatePathRequested : SftpAction
    data object UploadRequested : SftpAction
    data object MoreActionsRequested : SftpAction
    data object Refresh : SftpAction
    data object ToggleHiddenFiles : SftpAction
}
