package com.nashaofu.shell360.feature.terminal

import androidx.compose.ui.graphics.Color

/**
 * Mirrors `TERMINAL_THEMES` in `packages/shared/src/components/XTerminal/themes`.
 * The theme is a per-host setting and never follows the app light/dark mode.
 */
data class TerminalTheme(
    val name: String,
    val background: Color,
    val foreground: Color,
    val cursor: Color,
    val cursorAccent: Color,
    val selection: Color,
    val black: Color,
    val red: Color,
    val green: Color,
    val yellow: Color,
    val blue: Color,
    val magenta: Color,
    val cyan: Color,
    val white: Color,
    val brightBlack: Color,
    val brightRed: Color,
    val brightGreen: Color,
    val brightYellow: Color,
    val brightBlue: Color,
    val brightMagenta: Color,
    val brightCyan: Color,
    val brightWhite: Color,
) {
    /** The 16 ANSI colours in SGR order, so indexed colours can be looked up directly. */
    val ansiPalette: List<Color> = listOf(
        black, red, green, yellow, blue, magenta, cyan, white,
        brightBlack, brightRed, brightGreen, brightYellow,
        brightBlue, brightMagenta, brightCyan, brightWhite,
    )
}

private fun hex(value: Long): Color = Color(0xFF000000L or value)

private val NORD_PALETTE = listOf(
    hex(0x3B4252), hex(0xBF616A), hex(0xA3BE8C), hex(0xEBCB8B),
    hex(0x81A1C1), hex(0xB48EAD), hex(0x88C0D0), hex(0xE5E9F0),
    hex(0x4C566A), hex(0xBF616A), hex(0xA3BE8C), hex(0xEBCB8B),
    hex(0x81A1C1), hex(0xB48EAD), hex(0x8FBCBB), hex(0xECEFF4),
)

private val SOLARIZED_PALETTE = listOf(
    hex(0x073642), hex(0xDC322F), hex(0x859900), hex(0xB58900),
    hex(0x268BD2), hex(0xD33682), hex(0x2AA198), hex(0xEEE8D5),
    hex(0x002B36), hex(0xCB4B16), hex(0x586E75), hex(0x657B83),
    hex(0x839496), hex(0x6C71C4), hex(0x93A1A1), hex(0xFDF6E3),
)

private val TANGO_PALETTE = listOf(
    hex(0x000000), hex(0xD81E00), hex(0x5EA702), hex(0xCFAE00),
    hex(0x427AB3), hex(0x89658E), hex(0x00A7AA), hex(0xDBDED8),
    hex(0x686A66), hex(0xF54235), hex(0x99E343), hex(0xFDEB61),
    hex(0x84B0D8), hex(0xBC94B7), hex(0x37E6E8), hex(0xF1F1F0),
)

private fun theme(
    name: String,
    background: Long,
    foreground: Long,
    cursor: Long,
    cursorAccent: Long,
    selection: Long,
    palette: List<Color>,
    white: Color = palette[7],
): TerminalTheme = TerminalTheme(
    name = name,
    background = hex(background),
    foreground = hex(foreground),
    cursor = hex(cursor),
    cursorAccent = hex(cursorAccent),
    selection = hex(selection),
    black = palette[0],
    red = palette[1],
    green = palette[2],
    yellow = palette[3],
    blue = palette[4],
    magenta = palette[5],
    cyan = palette[6],
    white = white,
    brightBlack = palette[8],
    brightRed = palette[9],
    brightGreen = palette[10],
    brightYellow = palette[11],
    brightBlue = palette[12],
    brightMagenta = palette[13],
    brightCyan = palette[14],
    brightWhite = palette[15],
)

val NORD_DARK = theme(
    name = "Nord Dark",
    background = 0x2E3440, foreground = 0xD8DEE9, cursor = 0xECEFF4,
    cursorAccent = 0x2E3440, selection = 0xECEFF4, palette = NORD_PALETTE,
)

val NORD_LIGHT = theme(
    name = "Nord Light",
    background = 0xE5E9F0, foreground = 0x414858, cursor = 0x88C0D0,
    cursorAccent = 0xE5E9F0, selection = 0xD8DEE9, palette = NORD_PALETTE,
    white = hex(0xD8DEE9),
)

val SOLARIZED_DARK = theme(
    name = "Solarized Dark",
    background = 0x002B36, foreground = 0x839496, cursor = 0x839496,
    cursorAccent = 0x002B36, selection = 0x073642, palette = SOLARIZED_PALETTE,
)

val SOLARIZED_LIGHT = theme(
    name = "Solarized Light",
    background = 0xFDF6E3, foreground = 0x657B83, cursor = 0x657B83,
    cursorAccent = 0xFDF6E3, selection = 0xEEE8D5, palette = SOLARIZED_PALETTE,
)

val TANGO_DARK = theme(
    name = "Tango Dark",
    background = 0x000000, foreground = 0xFFFFFF, cursor = 0xFFFFFF,
    cursorAccent = 0x000000, selection = 0xC1DEFF, palette = TANGO_PALETTE,
)

val TANGO_LIGHT = theme(
    name = "Tango Light",
    background = 0xFFFFFF, foreground = 0x000000, cursor = 0x000000,
    cursorAccent = 0xFFFFFF, selection = 0xC1DEFF, palette = TANGO_PALETTE,
)

/** Order matters: it is the order of the theme picker, and index 0 is the default. */
val TERMINAL_THEME_LIST: List<TerminalTheme> = listOf(
    NORD_DARK, NORD_LIGHT, SOLARIZED_DARK, SOLARIZED_LIGHT, TANGO_DARK, TANGO_LIGHT,
)

private val TERMINAL_THEMES_BY_NAME: Map<String, TerminalTheme> =
    TERMINAL_THEME_LIST.associateBy { it.name }

/** Mirrors `TERMINAL_THEMES_MAP.get(name)?.theme ?? DEFAULT_TERMINAL_THEME`. */
fun terminalThemeByName(name: String?): TerminalTheme =
    name?.let { TERMINAL_THEMES_BY_NAME[it] } ?: NORD_DARK
