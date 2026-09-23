package com.nashaofu.shell360.feature.keys

sealed interface KeysAction {
    data class QueryChanged(val value: String) : KeysAction
    data class TypeSelected(val value: KeyType?) : KeysAction
    data object AddClicked : KeysAction
    data object GenerateClicked : KeysAction
    data class EditClicked(val key: KeyItem) : KeysAction
    data class DeleteClicked(val key: KeyItem) : KeysAction
    data class DuplicateClicked(val key: KeyItem) : KeysAction
    data object EditorDismissed : KeysAction
    data object GeneratorDismissed : KeysAction
    data class Saved(val key: KeyItem) : KeysAction
    data object GenerationRequested : KeysAction
    data object FeedbackDismissed : KeysAction
}
