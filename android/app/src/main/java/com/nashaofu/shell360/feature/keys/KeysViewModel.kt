package com.nashaofu.shell360.feature.keys

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import kotlinx.coroutines.launch

class KeysViewModel {
    var uiState: KeysUiState by mutableStateOf(KeysUiState())
        private set

    fun onAction(action: KeysAction) {
        uiState = when (action) {
            is KeysAction.QueryChanged -> uiState.copy(query = action.value)
            is KeysAction.TypeSelected -> uiState.copy(selectedType = action.value)
            KeysAction.AddClicked -> uiState.copy(editorKey = null, isEditorOpen = true)
            KeysAction.GenerateClicked -> uiState.copy(isGeneratorOpen = true)
            is KeysAction.EditClicked -> uiState.copy(editorKey = action.key, isEditorOpen = true)
            is KeysAction.DuplicateClicked -> {
                val copy = Shell360Store.duplicateKey(action.key)
                uiState.copy(editorKey = copy, isEditorOpen = true)
            }

            is KeysAction.DeleteClicked -> uiState.copy(deleteTarget = action.key)
            KeysAction.DeleteDismissed -> uiState.copy(deleteTarget = null)
            KeysAction.DeleteConfirmed -> {
                val target = uiState.deleteTarget
                if (target != null) AndroidRuntime.scope.launch {
                    runCatching { AndroidRuntime.deleteKey(target) }
                        .onSuccess { Shell360Store.deleteKey(target.id) }
                        .onFailure { uiState = uiState.copy(feedbackMessage = it.message ?: "Could not delete key") }
                }
                uiState.copy(deleteTarget = null)
            }

            KeysAction.EditorDismissed -> uiState.copy(editorKey = null, isEditorOpen = false)
            KeysAction.GeneratorDismissed -> uiState.copy(isGeneratorOpen = false)
            KeysAction.ClearFiltersClicked -> uiState.copy(query = "", selectedType = null)
            KeysAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }

    fun showFeedback(message: String) {
        uiState = uiState.copy(feedbackMessage = message)
    }
}
