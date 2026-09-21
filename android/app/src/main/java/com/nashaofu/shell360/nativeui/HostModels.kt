package com.nashaofu.shell360.nativeui

import org.json.JSONObject

enum class NativeAuthenticationMethod { Password, PublicKey, Certificate, Agent, KeyboardInteractive }

data class NativeHost(
    val id: String = "",
    val name: String = "",
    val hostname: String = "",
    val port: Int = 22,
    val username: String = "",
    val authenticationMethod: NativeAuthenticationMethod = NativeAuthenticationMethod.Password,
    val password: String = "",
    val keyId: String = "",
    val tags: List<String> = emptyList(),
    val envs: Map<String, String> = emptyMap(),
    val startupCommand: String = "",
    val terminalType: String = "xterm-256color",
    val terminalFontSize: Int = 18,
) {
    fun toJson(includeId: Boolean): JSONObject = JSONObject().apply {
        if (includeId && id.toLongOrNull() != null) put("id", id)
        put("name", name)
        put("hostname", hostname)
        put("port", port)
        put("username", username)
        put("authenticationMethod", authenticationMethod.name)
        put("password", password)
        if (keyId.toLongOrNull() != null) put("keyId", keyId)
        put("tags", org.json.JSONArray(tags))
        put("envs", org.json.JSONArray().apply {
            envs.forEach { (key, value) -> put(JSONObject().put("key", key).put("value", value)) }
        })
        put("startupCommand", startupCommand)
        put("terminalType", terminalType)
        put("terminalSettings", JSONObject().put("fontSize", terminalFontSize))
    }

    companion object {
        fun fromJson(value: JSONObject) = NativeHost(
            id = value.optString("id"),
            name = value.optString("name"),
            hostname = value.optString("hostname"),
            port = value.optInt("port", 22),
            username = value.optString("username"),
            authenticationMethod = runCatching {
                NativeAuthenticationMethod.valueOf(value.optString("authenticationMethod"))
            }.getOrDefault(NativeAuthenticationMethod.Password),
            password = value.optString("password"),
            keyId = value.optString("keyId").takeUnless { it.isBlank() || it == "null" } ?: "",
            tags = value.optJSONArray("tags")?.let { array -> buildList { for (index in 0 until array.length()) add(array.optString(index)) } } ?: emptyList(),
            envs = value.optJSONArray("envs")?.let { array ->
                buildMap {
                    for (index in 0 until array.length()) {
                        val item = array.optJSONObject(index) ?: continue
                        val key = item.optString("key")
                        if (key.isNotBlank()) put(key, item.optString("value"))
                    }
                }
            } ?: emptyMap(),
            startupCommand = value.optString("startupCommand"),
            terminalType = value.optString("terminalType", "xterm-256color"),
            terminalFontSize = value.optJSONObject("terminalSettings")?.optInt("fontSize", 18)?.coerceIn(8, 40) ?: 18,
        )
    }
}
