package com.nashaofu.shell360.feature.terminal

import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_FONT_FAMILY
import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_FONT_SIZE
import com.nashaofu.shell360.core.data.MAX_TERMINAL_FONT_SIZE
import com.nashaofu.shell360.core.data.MIN_TERMINAL_FONT_SIZE

private const val GENERIC_MONOSPACE = "monospace"

/**
 * Mirrors the CSS font stack handling of xterm: `terminalSettings.fontFamily` is a CSS
 * font list such as `'courier-new','courier','monospace'`, so it has to be split and
 * de-quoted before it can be handed to the platform font resolver.
 */
fun parseFontFamilyCss(value: String?): List<String> {
    val raw = value?.takeIf { it.isNotBlank() } ?: DEFAULT_TERMINAL_FONT_FAMILY
    return raw
        .split(',')
        .map { it.trim().trim('\'', '"').trim() }
        .filter { it.isNotEmpty() }
}

/**
 * Turns a CSS family name into the name Android's `Typeface.create` expects:
 * `courier-new` -> `Courier New`, `monospace` -> `monospace` (a generic family is passed
 * through unchanged so the platform can resolve it).
 */
fun cssFontNameToAndroid(name: String): String {
    if (name.equals(GENERIC_MONOSPACE, ignoreCase = true)) return GENERIC_MONOSPACE
    return name
        .split('-', '_', ' ')
        .filter { it.isNotEmpty() }
        .joinToString(" ") { part ->
            part.replaceFirstChar { first -> first.uppercaseChar() }
        }
}

/** Mirrors the `fontSize` bounds enforced by `TerminalSettingsForm`. */
fun clampTerminalFontSize(size: Int?): Int =
    (size ?: DEFAULT_TERMINAL_FONT_SIZE).coerceIn(MIN_TERMINAL_FONT_SIZE, MAX_TERMINAL_FONT_SIZE)
