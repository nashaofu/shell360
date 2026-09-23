package com.nashaofu.shell360.feature.keys

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class KeysViewModel {
    var uiState: KeysUiState by mutableStateOf(KeysUiState())
        private set

    val visibleKeys: List<KeyItem>
        get() {
            val query = uiState.query.trim().lowercase()
            return uiState.keys.filter { key ->
                (uiState.selectedType == null || uiState.selectedType == key.type) &&
                    (query.isEmpty() || key.name.lowercase().contains(query) || key.publicKey.lowercase().contains(query))
            }
        }

    fun onAction(action: KeysAction) {
        uiState = when (action) {
            is KeysAction.QueryChanged -> uiState.copy(query = action.value)
            is KeysAction.TypeSelected -> uiState.copy(selectedType = action.value)
            KeysAction.AddClicked -> uiState.copy(editorKey = null, isEditorOpen = true)
            KeysAction.GenerateClicked -> uiState.copy(isGeneratorOpen = true)
            is KeysAction.EditClicked -> uiState.copy(editorKey = action.key, isEditorOpen = true)
            is KeysAction.DeleteClicked -> uiState.copy(pendingDelete = action.key)
            is KeysAction.DuplicateClicked -> uiState.copy(editorKey = action.key.copy(id = "key-${System.currentTimeMillis()}", name = "${action.key.name} Copy"), isEditorOpen = true)
            KeysAction.EditorDismissed -> uiState.copy(editorKey = null, isEditorOpen = false)
            KeysAction.GeneratorDismissed -> uiState.copy(isGeneratorOpen = false)
            is KeysAction.Saved -> {
                uiState.copy(
                    editorKey = null,
                    isEditorOpen = false,
                    feedbackMessage = "Keys storage is not connected on Android yet.",
                )
            }
            KeysAction.GenerationRequested -> uiState.copy(
                isGeneratorOpen = false,
                feedbackMessage = "Key generation is not connected on Android yet.",
            )
            KeysAction.FeedbackDismissed -> uiState.copy(feedbackMessage = null)
        }
    }

    fun confirmDelete() {
        if (uiState.pendingDelete == null) return
        uiState = uiState.copy(
            pendingDelete = null,
            feedbackMessage = "Keys storage is not connected on Android yet.",
        )
    }

    fun cancelDelete() {
        uiState = uiState.copy(pendingDelete = null)
    }
}
