package com.nashaofu.shell360.feature.keys

enum class KeyType(val label: String) {
    Ed25519("Ed25519"),
    RSA("RSA"),
    ECDSA("ECDSA"),
}

data class KeyItem(
    val id: String,
    val name: String,
    val type: KeyType,
    val publicKey: String,
    val privateKey: String = "",
    val passphrase: String = "",
    val certificate: String = "",
)

data class KeysUiState(
    val keys: List<KeyItem> = emptyList(),
    val isLoading: Boolean = false,
    val query: String = "",
    val selectedType: KeyType? = null,
    val editorKey: KeyItem? = null,
    val isEditorOpen: Boolean = false,
    val isGeneratorOpen: Boolean = false,
    val pendingDelete: KeyItem? = null,
    val feedbackMessage: String? = null,
)
