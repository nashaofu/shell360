package com.nashaofu.shell360.nativeui

import com.nashaofu.shell360.terminal.NativeRuntimeClient

class HostRepository(private val runtime: NativeRuntimeClient) {
    fun getAll(onResult: (Result<List<NativeHost>>) -> Unit) {
        runtime.request("data.getHosts") { response ->
            onResult(if (response.has("error")) Result.failure(response.toRuntimeError()) else runCatching {
                val data = response.getJSONArray("data")
                buildList { for (index in 0 until data.length()) add(NativeHost.fromJson(data.getJSONObject(index))) }
            })
        }
    }

    fun save(host: NativeHost, onResult: (Result<NativeHost>) -> Unit) {
        val existingId = host.id.toLongOrNull()
        val method = if (existingId == null) "data.addHost" else "data.updateHost"
        runtime.request(method, host.toJson(existingId != null)) { response ->
            onResult(
                if (response.has("error")) Result.failure(response.toRuntimeError())
                else runCatching {
                    val data = response.optJSONObject("data")
                        ?: error("Save host returned no host data")
                    NativeHost.fromJson(data)
                },
            )
        }
    }

    fun delete(host: NativeHost, onResult: (Result<Unit>) -> Unit) {
        runtime.request("data.deleteHost", host.toJson(true)) { response ->
            onResult(if (response.has("error")) Result.failure(IllegalStateException(response.toString())) else Result.success(Unit))
        }
    }
}
