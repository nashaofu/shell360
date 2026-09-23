package com.nashaofu.shell360.feature.sftp

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class SftpViewModel {
    var uiState: SftpUiState by mutableStateOf(SftpUiState())
        private set

    fun onAction(action: SftpAction) {
        uiState = when (action) {
            is SftpAction.QueryChanged -> uiState.copy(query = action.value)
            is SftpAction.PathChanged -> uiState.copy(pathDraft = action.value)
            SftpAction.NavigatePathRequested -> uiState.copy(errorMessage = "SFTP runtime is not connected on Android yet.")
            SftpAction.UploadRequested -> uiState.copy(errorMessage = "File upload is not connected on Android yet.")
            SftpAction.MoreActionsRequested -> uiState.copy(errorMessage = "SFTP file actions are not connected on Android yet.")
            SftpAction.Refresh -> uiState.copy(errorMessage = "SFTP runtime is not connected on Android yet.")
            SftpAction.ToggleHiddenFiles -> uiState.copy(showHiddenFiles = !uiState.showHiddenFiles)
        }
    }
}
