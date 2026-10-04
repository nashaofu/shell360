package com.nashaofu.shell360.core.data

import org.json.JSONArray
import org.json.JSONObject

object AppDataJson {
    fun export(): String {
        val root = JSONObject()

        root.put(
            "hosts",
            JSONArray().apply {
                Shell360Store.hosts.forEach { host ->
                    put(
                        JSONObject().apply {
                            put("id", host.id)
                            put("name", host.name)
                            put("tags", JSONArray(host.tags))
                            put("hostname", host.hostname)
                            put("port", host.port)
                            put("username", host.username)
                            put("authenticationMethod", host.authenticationMethod.name)
                            put("password", host.password)
                            put("keyId", host.keyId)
                            put("startupCommand", host.startupCommand)
                            put("terminalType", host.terminalType)
                            put(
                                "envs",
                                JSONArray().apply {
                                    host.envs.forEach { env ->
                                        put(
                                            JSONObject().apply {
                                                put("key", env.key)
                                                put("value", env.value)
                                            },
                                        )
                                    }
                                },
                            )
                            put("jumpHostIds", JSONArray(host.jumpHostIds))
                            put(
                                "terminalSettings",
                                JSONObject().apply {
                                    put("fontFamily", host.terminalSettings.fontFamily)
                                    put("fontSize", host.terminalSettings.fontSize)
                                    put("theme", host.terminalSettings.theme)
                                },
                            )
                        },
                    )
                }
            },
        )

        root.put(
            "keys",
            JSONArray().apply {
                Shell360Store.keys.forEach { key ->
                    put(
                        JSONObject().apply {
                            put("id", key.id)
                            put("name", key.name)
                            put("publicKey", key.publicKey)
                            put("privateKey", key.privateKey)
                            put("passphrase", key.passphrase)
                            put("certificate", key.certificate)
                        },
                    )
                }
            },
        )

        root.put(
            "knownHosts",
            JSONArray().apply {
                Shell360Store.knownHosts.forEach { item ->
                    put(
                        JSONObject().apply {
                            put("id", item.id)
                            put("host", item.host)
                            put("type", item.type)
                            put("key", item.key)
                            put("marker", item.marker)
                        },
                    )
                }
            },
        )

        root.put(
            "tunnels",
            JSONArray().apply {
                Shell360Store.tunnels.forEach { tunnel ->
                    put(
                        JSONObject().apply {
                            put("id", tunnel.id)
                            put("name", tunnel.name)
                            put("type", tunnel.type.name)
                            put("hostId", tunnel.hostId)
                            put("localAddress", tunnel.localAddress)
                            put("localPort", tunnel.localPort)
                            put("remoteAddress", tunnel.remoteAddress)
                            put("remotePort", tunnel.remotePort ?: 0)
                        },
                    )
                }
            },
        )

        return root.toString(2)
    }

    fun importToModels(text: String): ImportedAppData {
        val root = JSONObject(text)
        fun strings(array: JSONArray?): List<String> = (0 until (array?.length() ?: 0)).map { array?.optString(it).orEmpty() }
        fun envs(array: JSONArray?): List<EnvVar> = (0 until (array?.length() ?: 0)).mapNotNull { index ->
            array?.optJSONObject(index)?.let { EnvVar(it.optString("key"), it.optString("value")) }
        }
        val keys = (0 until (root.optJSONArray("keys")?.length() ?: 0)).mapNotNull { index ->
            root.optJSONArray("keys")?.optJSONObject(index)?.let { item ->
                KeyModel(item.optString("id").ifEmpty { newId() }, item.optString("name"), item.optString("publicKey"), item.optString("privateKey"), item.optString("passphrase"), item.optString("certificate"))
            }
        }
        val hosts = (0 until (root.optJSONArray("hosts")?.length() ?: 0)).mapNotNull { index ->
            root.optJSONArray("hosts")?.optJSONObject(index)?.let { item ->
                val settings = item.optJSONObject("terminalSettings")
                HostModel(
                    id = item.optString("id").ifEmpty { newId() }, name = item.optString("name"), tags = strings(item.optJSONArray("tags")),
                    hostname = item.optString("hostname"), port = item.optInt("port", 22), username = item.optString("username"),
                    authenticationMethod = runCatching { AuthMethod.valueOf(item.optString("authenticationMethod")) }.getOrDefault(AuthMethod.Password),
                    password = item.optString("password"), keyId = item.optString("keyId"), startupCommand = item.optString("startupCommand"),
                    terminalType = item.optString("terminalType", DEFAULT_TERMINAL_TYPE), envs = envs(item.optJSONArray("envs")), jumpHostIds = strings(item.optJSONArray("jumpHostIds")),
                    terminalSettings = HostTerminalSettings(settings?.optString("fontFamily", DEFAULT_TERMINAL_FONT_FAMILY) ?: DEFAULT_TERMINAL_FONT_FAMILY, settings?.optInt("fontSize", DEFAULT_TERMINAL_FONT_SIZE) ?: DEFAULT_TERMINAL_FONT_SIZE, settings?.optString("theme", DEFAULT_TERMINAL_THEME) ?: DEFAULT_TERMINAL_THEME),
                )
            }
        }
        val knownHosts = (0 until (root.optJSONArray("knownHosts")?.length() ?: 0)).mapNotNull { index ->
            root.optJSONArray("knownHosts")?.optJSONObject(index)?.let { item ->
                KnownHostModel(item.optString("id").ifEmpty { newId() }, item.optString("host"), item.optString("type"), item.optString("key"), item.optString("marker"))
            }
        }
        val tunnels = (0 until (root.optJSONArray("tunnels")?.length() ?: 0)).mapNotNull { index ->
            root.optJSONArray("tunnels")?.optJSONObject(index)?.let { item ->
                TunnelModel(
                    id = item.optString("id").ifEmpty { newId() }, name = item.optString("name"),
                    type = runCatching { TunnelType.valueOf(item.optString("type")) }.getOrDefault(TunnelType.Local), hostId = item.optString("hostId"),
                    localAddress = item.optString("localAddress"), localPort = item.optInt("localPort"), remoteAddress = item.optString("remoteAddress"), remotePort = item.optInt("remotePort").takeIf { it > 0 },
                )
            }
        }
        return ImportedAppData(hosts, keys, knownHosts, tunnels)
    }

    fun import(text: String) {
        val imported = importToModels(text)
        Shell360Store.hosts.replaceWith(imported.hosts)
        Shell360Store.keys.replaceWith(imported.keys)
        Shell360Store.knownHosts.replaceWith(imported.knownHosts)
        Shell360Store.tunnels.replaceWith(imported.tunnels)
    }

    fun export(text: String) = text

    fun import(text: String) {
        val root = JSONObject(text)

        Shell360Store.hosts.clear()
        root.optJSONArray("hosts")?.let { array ->
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                Shell360Store.hosts.add(
                    HostModel(
                        id = item.optString("id").ifEmpty { newId() },
                        name = item.optString("name"),
                        tags = item.optJSONArray("tags").toStringList(),
                        hostname = item.optString("hostname"),
                        port = item.optInt("port", 22),
                        username = item.optString("username"),
                        authenticationMethod = runCatching {
                            AuthMethod.valueOf(item.optString("authenticationMethod"))
                        }.getOrDefault(AuthMethod.Password),
                        password = item.optString("password"),
                        keyId = item.optString("keyId"),
                        startupCommand = item.optString("startupCommand"),
                        terminalType = item.optString("terminalType").ifEmpty { DEFAULT_TERMINAL_TYPE },
                        envs = item.optJSONArray("envs").toEnvList(),
                        jumpHostIds = item.optJSONArray("jumpHostIds").toStringList(),
                        terminalSettings = item.optJSONObject("terminalSettings")?.let { settings ->
                            HostTerminalSettings(
                                fontFamily = settings.optString("fontFamily")
                                    .ifEmpty { DEFAULT_TERMINAL_FONT_FAMILY },
                                fontSize = settings.optInt("fontSize", DEFAULT_TERMINAL_FONT_SIZE),
                                theme = settings.optString("theme").ifEmpty { DEFAULT_TERMINAL_THEME },
                            )
                        } ?: HostTerminalSettings(),
                    ),
                )
            }
        }

        Shell360Store.keys.clear()
        root.optJSONArray("keys")?.let { array ->
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                Shell360Store.keys.add(
                    KeyModel(
                        id = item.optString("id").ifEmpty { newId() },
                        name = item.optString("name"),
                        publicKey = item.optString("publicKey"),
                        privateKey = item.optString("privateKey"),
                        passphrase = item.optString("passphrase"),
                        certificate = item.optString("certificate"),
                    ),
                )
            }
        }

        Shell360Store.knownHosts.clear()
        root.optJSONArray("knownHosts")?.let { array ->
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                Shell360Store.knownHosts.add(
                    KnownHostModel(
                        id = item.optString("id").ifEmpty { newId() },
                        host = item.optString("host"),
                        type = item.optString("type"),
                        key = item.optString("key"),
                        marker = item.optString("marker"),
                    ),
                )
            }
        }

        Shell360Store.tunnels.clear()
        root.optJSONArray("tunnels")?.let { array ->
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                Shell360Store.tunnels.add(
                    TunnelModel(
                        id = item.optString("id").ifEmpty { newId() },
                        name = item.optString("name"),
                        type = runCatching {
                            TunnelType.valueOf(item.optString("type"))
                        }.getOrDefault(TunnelType.Local),
                        hostId = item.optString("hostId"),
                        localAddress = item.optString("localAddress"),
                        localPort = item.optInt("localPort"),
                        remoteAddress = item.optString("remoteAddress"),
                        remotePort = item.optInt("remotePort").takeIf { it > 0 },
                    ),
                )
            }
        }
    }
}

data class ImportedAppData(val hosts: List<HostModel>, val keys: List<KeyModel>, val knownHosts: List<KnownHostModel>, val tunnels: List<TunnelModel>)

private fun <T> androidx.compose.runtime.snapshots.SnapshotStateList<T>.replaceWith(items: List<T>) {
    clear()
    addAll(items)
}

private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return (0 until length()).map { optString(it) }
}

private fun JSONArray?.toEnvList(): List<EnvVar> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { index ->
        val item = optJSONObject(index) ?: return@mapNotNull null
        EnvVar(item.optString("key"), item.optString("value"))
    }
}
