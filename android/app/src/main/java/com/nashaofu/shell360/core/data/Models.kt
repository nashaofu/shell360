package com.nashaofu.shell360.core.data

import java.util.UUID

const val DEFAULT_TERMINAL_FONT_FAMILY = "'courier-new','courier','monospace'"
const val DEFAULT_TERMINAL_FONT_SIZE = 14
const val DEFAULT_TERMINAL_TYPE = "xterm-256color"
const val DEFAULT_TERMINAL_THEME = "Nord Dark"

/** Bounds enforced by `TerminalSettingsForm` in the WebView implementation. */
const val MIN_TERMINAL_FONT_SIZE = 10
const val MAX_TERMINAL_FONT_SIZE = 48

val TERMINAL_TYPES = listOf(
    "xterm-256color",
    "xterm-color",
    "xterm",
    "tmux-256color",
    "tmux",
    "screen-256color",
    "screen",
    "linux",
    "vt220",
    "vt102",
    "vt100",
    "ansi",
    "rxvt-unicode",
    "rxvt",
)

val TERMINAL_THEMES = listOf(
    "Nord Dark",
    "Nord Light",
    "Solarized Dark",
    "Solarized Light",
    "Tango Dark",
    "Tango Light",
)

fun newId(): String = UUID.randomUUID().toString()

enum class AuthMethod(val label: String) {
    Password("Password"),
    PublicKey("PublicKey"),
    Certificate("Certificate"),
    Agent("SSH Agent"),
    KeyboardInteractive("Keyboard Interactive"),
}

data class EnvVar(val key: String, val value: String)

fun parseEnvs(value: String): List<EnvVar> {
    if (value.isBlank()) return emptyList()
    return value.split(",").mapNotNull { entry ->
        val index = entry.indexOf('=')
        if (index == -1) return@mapNotNull null
        val key = entry.substring(0, index).trim()
        val envValue = entry.substring(index + 1).trim()
        if (key.isEmpty() || envValue.isEmpty()) null else EnvVar(key, envValue)
    }
}

fun stringifyEnvs(envs: List<EnvVar>): String =
    envs.joinToString(",") { "${it.key}=${it.value}" }

fun validateEnvs(value: String): String? {
    if (value.isBlank()) return null
    for (entry in value.split(",")) {
        val index = entry.indexOf('=')
        if (index == -1) return "Invalid environment variable format"
        val key = entry.substring(0, index).trim()
        val envValue = entry.substring(index + 1).trim()
        if (key.isEmpty() || envValue.isEmpty()) return "Invalid environment variable format"
    }
    return null
}

data class HostTerminalSettings(
    val fontFamily: String = DEFAULT_TERMINAL_FONT_FAMILY,
    val fontSize: Int = DEFAULT_TERMINAL_FONT_SIZE,
    val theme: String = DEFAULT_TERMINAL_THEME,
)

data class HostModel(
    val id: String = newId(),
    val name: String = "",
    val tags: List<String> = emptyList(),
    val hostname: String = "",
    val port: Int = 22,
    val username: String = "",
    val authenticationMethod: AuthMethod = AuthMethod.Password,
    val password: String = "",
    val keyId: String = "",
    val startupCommand: String = "",
    val terminalType: String = DEFAULT_TERMINAL_TYPE,
    val envs: List<EnvVar> = emptyList(),
    val jumpHostIds: List<String> = emptyList(),
    val terminalSettings: HostTerminalSettings = HostTerminalSettings(),
) {
    val title: String get() = name.ifBlank { "$hostname:$port" }
    val description: String get() = "$username@$hostname:$port"

    val authenticationSummary: String
        get() = when (authenticationMethod) {
            AuthMethod.Password -> "Password"
            AuthMethod.PublicKey -> "Public key"
            AuthMethod.Certificate -> "Certificate"
            AuthMethod.Agent -> "SSH agent"
            AuthMethod.KeyboardInteractive -> "Keyboard interactive"
        }
}

data class KeyModel(
    val id: String = newId(),
    val name: String = "",
    val publicKey: String = "",
    val privateKey: String = "",
    val passphrase: String = "",
    val certificate: String = "",
) {
    val typeLabel: String get() = keyTypeLabel(publicKey)
    val preview: String get() = keyPreview(publicKey)
}

fun keyTypeLabel(publicKey: String): String {
    val type = publicKey.trim().split(Regex("\\s+")).firstOrNull().orEmpty()
    return when (type) {
        "ssh-ed25519", "sk-ssh-ed25519@openssh.com" -> "Ed25519"
        "ssh-rsa", "ssh-rsa-cert-v01@openssh.com" -> "RSA"
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "sk-ecdsa-sha2-nistp256@openssh.com",
        -> "ECDSA"

        else -> type
            .replace(Regex("^ssh-"), "")
            .replace(Regex("^sk-"), "")
            .replace(Regex("-cert.*$"), "")
            .uppercase()
            .ifEmpty { "Key" }
    }
}

fun keyPreview(publicKey: String): String {
    val parts = publicKey.trim().split(Regex("\\s+"))
    val value = parts.getOrNull(1) ?: publicKey.trim()
    return if (value.length <= 24) value else "${value.take(12)}...${value.takeLast(7)}"
}

enum class KeyAlgorithm(val label: String) {
    Ed25519("ed25519"),
    Rsa("rsa"),
    Ecdsa("ecdsa"),
}

val RSA_BIT_SIZES = listOf(2048, 4096)
val ECDSA_CURVES = listOf("NIST P-256" to "NistP256", "NIST P-384" to "NistP384", "NIST P-521" to "NistP521")

data class KnownHostModel(
    val id: String = newId(),
    val host: String = "",
    val type: String = "",
    val key: String = "",
    val marker: String = "",
) {
    val rawLine: String get() = listOf(marker, host, type, key).filter { it.isNotEmpty() }.joinToString(" ")
    val fingerprintPreview: String
        get() = if (key.length <= 18) key else "${key.take(12)}...${key.takeLast(4)}"
}

enum class TunnelType(val label: String) {
    Local("Local tunnel"),
    Remote("Remote tunnel"),
    Dynamic("Dynamic tunnel"),
}

data class TunnelModel(
    val id: String = newId(),
    val name: String = "",
    val type: TunnelType = TunnelType.Local,
    val hostId: String = "",
    val localAddress: String = "",
    val localPort: Int = 0,
    val remoteAddress: String = "",
    val remotePort: Int? = null,
) {
    fun description(hostName: String): String = when (type) {
        TunnelType.Local ->
            "Local $localAddress:$localPort => $hostName => remote $remoteAddress:${remotePort ?: ""}"

        TunnelType.Remote ->
            "Remote $remoteAddress:${remotePort ?: ""} => $hostName  => local $localAddress:$localPort"

        TunnelType.Dynamic ->
            "Local proxy $localAddress:$localPort => $hostName  => any address"
    }
}

enum class SessionKind(val label: String) { Terminal("Terminal"), Sftp("SFTP") }

enum class SessionStatus(val label: String) {
    Pending("Connecting"),
    Success("Connected"),
    Failed("Failed"),
}

data class SessionModel(
    val id: String = newId(),
    val name: String = "",
    val kind: SessionKind = SessionKind.Terminal,
    val hostId: String = "",
    val status: SessionStatus = SessionStatus.Pending,
    val error: String? = null,
    val errorCode: String? = null,
    val errorType: String? = null,
    val sshShellId: String? = null,
    val sshSftpId: String? = null,
    val terminalOutput: String = "",
)

data class TunnelRuntime(
    val tunnelId: String = "",
    val status: SessionStatus = SessionStatus.Pending,
    val error: String? = null,
)
