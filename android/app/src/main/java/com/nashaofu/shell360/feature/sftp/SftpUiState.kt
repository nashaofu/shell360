package com.nashaofu.shell360.feature.sftp

data class SftpUiState(
    val path: String = "/",
    val pathDraft: String = "/",
    val query: String = "",
    val errorMessage: String? = "SFTP runtime is not connected on Android yet.",
    val showHiddenFiles: Boolean = false,
)
