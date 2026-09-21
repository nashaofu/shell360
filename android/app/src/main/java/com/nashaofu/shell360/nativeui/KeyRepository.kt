package com.nashaofu.shell360.nativeui

import com.nashaofu.shell360.terminal.NativeRuntimeClient

class KeyRepository(private val runtime: NativeRuntimeClient) {
    fun generate(type: String, bitSize: Int?, curve: String?, passphrase: String, onResult: (Result<NativeKey>) -> Unit) {
        val algorithm = org.json.JSONObject().put("type", type)
        bitSize?.let { algorithm.put("bitSize", it) }
        curve?.let { algorithm.put("curve", it) }
        runtime.request("keygen.generate", org.json.JSONObject().put("algorithm", algorithm).put("passphrase", passphrase)) { response ->
            if (response.has("error")) onResult(Result.failure(response.toRuntimeError())) else runCatching {
                val data = response.getJSONObject("data")
                NativeKey(privateKey = data.optString("privateKey"), publicKey = data.optString("publicKey"), passphrase = passphrase)
            }.also { onResult(it) }
        }
    }
    fun getAll(onResult: (Result<List<NativeKey>>) -> Unit) {
        runtime.request("data.getKeys") { response ->
            onResult(if (response.has("error")) Result.failure(response.toRuntimeError()) else runCatching {
                val data = response.getJSONArray("data")
                buildList { for (index in 0 until data.length()) add(NativeKey.fromJson(data.getJSONObject(index))) }
            })
        }
    }

    fun save(key: NativeKey, onResult: (Result<NativeKey>) -> Unit) {
        val method = if (key.id.isEmpty()) "data.addKey" else "data.updateKey"
        runtime.request(method, key.toJson(key.id.isNotEmpty())) { response ->
            onResult(if (response.has("error")) Result.failure(response.toRuntimeError()) else runCatching { NativeKey.fromJson(response.getJSONObject("data")) })
        }
    }

    fun delete(key: NativeKey, onResult: (Result<Unit>) -> Unit) {
        runtime.request("data.deleteKey", key.toJson(true)) { response ->
            onResult(if (response.has("error")) Result.failure(IllegalStateException(response.toString())) else Result.success(Unit))
        }
    }
}
