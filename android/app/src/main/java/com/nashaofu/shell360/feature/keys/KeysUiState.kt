package com.nashaofu.shell360.feature.keys

import com.nashaofu.shell360.core.data.KeyModel

val KEY_TYPE_OPTIONS = listOf("Ed25519", "RSA", "ECDSA")

data class KeysUiState(
    val query: String = "",
    val selectedType: String? = null,
    val editorKey: KeyModel? = null,
    val isEditorOpen: Boolean = false,
    val isGeneratorOpen: Boolean = false,
    val deleteTarget: KeyModel? = null,
    val feedbackMessage: String? = null,
)

fun filterKeys(keys: List<KeyModel>, query: String, selectedType: String?): List<KeyModel> {
    val keyword = query.trim().lowercase()
    return keys.filter { key ->
        if (selectedType != null && key.typeLabel != selectedType) {
            return@filter false
        }
        if (keyword.isEmpty()) {
            return@filter true
        }
        key.name.lowercase().contains(keyword) || key.publicKey.lowercase().contains(keyword)
    }
}
