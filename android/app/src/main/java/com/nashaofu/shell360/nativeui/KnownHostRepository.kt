package com.nashaofu.shell360.nativeui

import android.content.Context
import java.io.File

data class NativeKnownHost(
    val host: String,
    val type: String,
    val key: String,
    val rawLine: String,
    val lineIndex: Int,
)

class KnownHostRepository(context: Context) {
    private val file = File(context.filesDir, "shell360/known_hosts")

    fun getAll(): List<NativeKnownHost> = parse(runCatching { file.readText() }.getOrDefault(""))

    fun delete(item: NativeKnownHost) {
        val lines = runCatching { file.readLines() }.getOrDefault(emptyList()).toMutableList()
        if (item.lineIndex in lines.indices && lines[item.lineIndex] == item.rawLine) {
            lines.removeAt(item.lineIndex)
        } else {
            lines.removeAll { it.trim() == item.rawLine.trim() }
        }
        file.parentFile?.mkdirs()
        file.writeText(lines.joinToString("\n"))
    }

    fun add(host: String, type: String, key: String) {
        require(host.isNotBlank() && type.isNotBlank() && key.isNotBlank()) { "Host, key type and key are required." }
        val content = runCatching { file.readText() }.getOrDefault("")
        file.parentFile?.mkdirs()
        val separator = if (content.isBlank()) "" else "\n"
        file.writeText(content.trimEnd() + separator + "$host $type $key\n")
    }

    fun removeHost(hostname: String, port: Int) {
        val candidates = setOf(hostname, "[$hostname]:$port", "$hostname:$port")
        val lines = runCatching { file.readLines() }.getOrDefault(emptyList())
        val filtered = lines.filterNot { raw ->
            val parts = raw.trim().split(Regex("\\s+"))
            if (parts.isEmpty() || parts[0].startsWith("#")) false
            else parts[0].split(',').any { it in candidates }
        }
        file.parentFile?.mkdirs()
        file.writeText(filtered.joinToString("\n") { it } + if (filtered.isEmpty()) "" else "\n")
    }

    private fun parse(content: String): List<NativeKnownHost> = buildList {
        content.split("\r?\n".toRegex()).forEachIndexed { index, raw ->
            val line = raw.trim()
            if (line.isEmpty() || line.startsWith("#")) return@forEachIndexed
            val parts = line.split(Regex("\\s+"))
            if (parts.size < 3) return@forEachIndexed
            val marker = parts[0].startsWith("@")
            val hostIndex = if (marker) 1 else 0
            val typeIndex = if (marker) 2 else 1
            val keyIndex = if (marker) 3 else 2
            if (parts.size <= keyIndex) return@forEachIndexed
            add(NativeKnownHost(parts[hostIndex], parts[typeIndex], parts.drop(keyIndex).joinToString(" "), raw, index))
        }
    }
}
