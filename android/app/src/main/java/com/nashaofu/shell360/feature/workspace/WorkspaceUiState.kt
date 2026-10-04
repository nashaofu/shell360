package com.nashaofu.shell360.feature.workspace

data class WorkspaceUiState(
    val activeSessionId: String? = null,
    val isSessionPickerOpen: Boolean = false,
    val feedbackMessage: String? = null,
)
