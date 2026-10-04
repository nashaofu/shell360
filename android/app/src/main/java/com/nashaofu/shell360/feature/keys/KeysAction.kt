package com.nashaofu.shell360.feature.keys

import com.nashaofu.shell360.core.data.KeyModel

sealed interface KeysAction {
    data class QueryChanged(val value: String) : KeysAction
    data class TypeSelected(val value: String?) : KeysAction
    data object AddClicked : KeysAction
    data object GenerateClicked : KeysAction
    data class EditClicked(val key: KeyModel) : KeysAction
    data class DuplicateClicked(val key: KeyModel) : KeysAction
    data class DeleteClicked(val key: KeyModel) : KeysAction
    data object DeleteDismissed : KeysAction
    data object DeleteConfirmed : KeysAction
    data object EditorDismissed : KeysAction
    data object GeneratorDismissed : KeysAction
    data object ClearFiltersClicked : KeysAction
    data object FeedbackDismissed : KeysAction
}
