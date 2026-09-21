package com.nashaofu.shell360.nativeui

import org.json.JSONObject

data class NativeKey(
    val id: String = "",
    val name: String = "",
    val privateKey: String = "",
    val publicKey: String = "",
    val passphrase: String = "",
    val certificate: String = "",
) {
    fun toJson(includeId: Boolean) = JSONObject().apply {
        if (includeId) put("id", id)
        put("name", name)
        put("privateKey", privateKey)
        put("publicKey", publicKey)
        put("passphrase", passphrase)
        put("certificate", certificate)
    }

    companion object {
        fun fromJson(value: JSONObject) = NativeKey(
            id = value.optString("id"),
            name = value.optString("name"),
            privateKey = value.optString("privateKey"),
            publicKey = value.optString("publicKey"),
            passphrase = value.optString("passphrase"),
            certificate = value.optString("certificate"),
        )
    }
}
