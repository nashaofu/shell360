package com.nashaofu.shell360.feature.terminal

import androidx.compose.ui.graphics.Color
import com.nashaofu.shell360.core.data.DEFAULT_TERMINAL_FONT_FAMILY
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private const val ESC = "\u001B"

/** Locks the values documented in the WebView reference (`themes/index.ts`). */
class TerminalThemeTest {
    @Test
    fun themeListOrderMatchesTheReferencePicker() {
        assertEquals(
            listOf("Nord Dark", "Nord Light", "Solarized Dark", "Solarized Light", "Tango Dark", "Tango Light"),
            TERMINAL_THEME_LIST.map { it.name },
        )
    }

    @Test
    fun nordDarkIsTheDefaultAndMatchesTheReference() {
        val theme = terminalThemeByName(null)
        assertEquals("Nord Dark", theme.name)

        assertEquals(Color(0xFF2E3440), theme.background)
        assertEquals(Color(0xFFD8DEE9), theme.foreground)
        assertEquals(Color(0xFFECEFF4), theme.cursor)
        assertEquals(Color(0xFF2E3440), theme.cursorAccent)
        assertEquals(Color(0xFFECEFF4), theme.selection)
        assertEquals(Color(0xFF3B4252), theme.black)
        assertEquals(Color(0xFFBF616A), theme.red)
        assertEquals(Color(0xFF4C566A), theme.brightBlack)
        assertEquals(Color(0xFF8FBCBB), theme.brightCyan)
    }

    @Test
    fun nordLightUsesItsOwnBackgroundAndForeground() {
        val theme = terminalThemeByName("Nord Light")
        assertEquals(Color(0xFFE5E9F0), theme.background)
        assertEquals(Color(0xFF414858), theme.foreground)
        assertEquals(Color(0xFF88C0D0), theme.cursor)
        assertEquals(Color(0xFFD8DEE9), theme.white)
        // Palette entries other than white are shared with Nord Dark.
        assertEquals(Color(0xFFBF616A), theme.red)
    }

    @Test
    fun tangoDarkUsesPureWhiteForeground() {
        val theme = terminalThemeByName("Tango Dark")
        assertEquals(Color(0xFF000000), theme.background)
        assertEquals(Color(0xFFFFFFFF), theme.foreground)
        assertEquals(Color(0xFFF54235), theme.brightRed)
    }

    @Test
    fun solarizedLightSharesTheSolarizedPalette() {
        val dark = terminalThemeByName("Solarized Dark")
        val light = terminalThemeByName("Solarized Light")
        assertEquals(Color(0xFFFDF6E3), light.background)
        assertEquals(Color(0xFF657B83), light.foreground)
        assertEquals(dark.ansiPalette, light.ansiPalette)
        assertEquals(Color(0xFF93A1A1), light.brightCyan)
    }

    @Test
    fun unknownThemeFallsBackToTheDefault() {
        assertEquals("Nord Dark", terminalThemeByName("Nope").name)
        assertEquals("Tango Light", terminalThemeByName("Tango Light").name)
    }

    @Test
    fun ansiPaletteHasSixteenEntriesInSgrOrder() {
        val theme = terminalThemeByName("Nord Dark")
        assertEquals(16, theme.ansiPalette.size)
        assertEquals(theme.black, theme.ansiPalette[0])
        assertEquals(theme.white, theme.ansiPalette[7])
        assertEquals(theme.brightBlack, theme.ansiPalette[8])
        assertEquals(theme.brightWhite, theme.ansiPalette[15])
    }
}

class TerminalFontTest {
    @Test
    fun parsesTheDefaultCssFontList() {
        assertEquals(
            listOf("courier-new", "courier", "monospace"),
            parseFontFamilyCss(DEFAULT_TERMINAL_FONT_FAMILY),
        )
        assertEquals(
            listOf("courier-new", "courier", "monospace"),
            parseFontFamilyCss(null),
        )
    }

    @Test
    fun parsesQuotedAndSpacedFontLists() {
        assertEquals(listOf("Fira Code", "monospace"), parseFontFamilyCss("\"Fira Code\", monospace"))
        assertEquals(listOf("Menlo"), parseFontFamilyCss("  'Menlo'  "))
        assertEquals(listOf("courier-new", "courier", "monospace"), parseFontFamilyCss(""))
    }

    @Test
    fun mapsCssFamilyNamesToAndroidNames() {
        assertEquals("Courier New", cssFontNameToAndroid("courier-new"))
        assertEquals("Fira Code", cssFontNameToAndroid("fira_code"))
        assertEquals("monospace", cssFontNameToAndroid("Monospace"))
    }

    @Test
    fun clampsFontSizeToTheFormRange() {
        assertEquals(14, clampTerminalFontSize(null))
        assertEquals(20, clampTerminalFontSize(20))
        assertEquals(10, clampTerminalFontSize(4))
        assertEquals(48, clampTerminalFontSize(99))
    }
}

/** Locks the byte tables documented in `VirtualKeyboard/resolveInput.ts`. */
class KeyboardLayoutsTest {
    private val plain = KeyboardModifiers()
    private val ctrl = KeyboardModifiers(ctrl = true)
    private val shift = KeyboardModifiers(shift = true)
    private val alt = KeyboardModifiers(alt = true)

    private fun key(char: Char) = CharacterKey(char)
    private fun named(id: NamedKey) = KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Fn)
        .flatten()
        .filterIsInstance<NamedKeyboardKey>()
        .first { it.id == id }

    @Test
    fun rowCountsMatchTheReferenceLayouts() {
        assertEquals(6, KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Lowercase).size)
        assertEquals(6, KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Uppercase).size)
        assertEquals(9, KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Fn).size)
        assertEquals(4, KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Shortcuts).size)
    }

    @Test
    fun plainCharactersSendThemselves() {
        assertEquals("a", resolveKeyOutput(key('a')))
        assertEquals("7", resolveKeyOutput(key('7')))
        assertEquals("!", resolveKeyOutput(key('!')))
    }

    @Test
    fun shiftTogglesCaseAndDigits() {
        assertEquals("A", resolveKeyOutput(key('a'), shift))
        assertEquals("!", resolveKeyOutput(key('1'), shift))
        assertEquals("(", resolveKeyOutput(key('9'), shift))
    }

    @Test
    fun altPrefixesEscape() {
        assertEquals("${ESC}a", resolveKeyOutput(key('a'), alt))
        // Alt alone does not apply shift, so the digit is sent unchanged.
        assertEquals("${ESC}1", resolveKeyOutput(key('1'), alt))
        assertEquals("${ESC}!", resolveKeyOutput(key('1'), KeyboardModifiers(alt = true, shift = true)))
    }

    @Test
    fun ctrlProducesControlBytes() {
        assertEquals("\u0001", resolveKeyOutput(key('a'), ctrl))
        assertEquals("\u0003", resolveKeyOutput(key('c'), ctrl))
        assertEquals("\u001A", resolveKeyOutput(key('z'), ctrl))
        assertEquals("${ESC}\u0001", resolveKeyOutput(key('a'), KeyboardModifiers(ctrl = true, alt = true)))
    }

    @Test
    fun controlByteTable() {
        assertEquals("${ESC}", resolveKeyOutput(key('['), ctrl))
        assertEquals("\u001C", resolveKeyOutput(key('\\'), ctrl))
        assertEquals("\u001D", resolveKeyOutput(key(']'), ctrl))
        assertEquals("\u001F", resolveKeyOutput(key('/'), ctrl))
        assertEquals("\u0000", resolveKeyOutput(key('@'), ctrl))
        assertEquals("\u001E", resolveKeyOutput(key('^'), ctrl))
    }

    @Test
    fun namedKeysSendTheirDocumentedBytes() {
        assertEquals(ESC, resolveKeyOutput(named(NamedKey.Escape)))
        assertEquals("\t", resolveKeyOutput(named(NamedKey.Tab)))
        assertEquals(" ", resolveKeyOutput(named(NamedKey.Space)))
        assertEquals("\u007F", resolveKeyOutput(named(NamedKey.Backspace)))
        assertEquals("\r", resolveKeyOutput(named(NamedKey.Enter)))
        assertEquals("${ESC}OP", resolveKeyOutput(named(NamedKey.F1)))
        assertEquals("${ESC}[15~", resolveKeyOutput(named(NamedKey.F5)))
        assertEquals("${ESC}[24~", resolveKeyOutput(named(NamedKey.F12)))
        assertEquals("${ESC}[2~", resolveKeyOutput(named(NamedKey.Insert)))
        assertEquals("${ESC}[5~", resolveKeyOutput(named(NamedKey.PageUp)))
    }

    @Test
    fun arrowsFollowApplicationCursorKeysMode() {
        assertEquals("${ESC}[D", resolveKeyOutput(named(NamedKey.ArrowLeft)))
        assertEquals("${ESC}OD", resolveKeyOutput(named(NamedKey.ArrowLeft), plain, applicationCursorKeys = true))
        assertEquals("${ESC}OF", resolveKeyOutput(named(NamedKey.End), plain, applicationCursorKeys = true))
        // Any modifier switches to the CSI form even in application mode.
        assertEquals("${ESC}[1;5D", resolveKeyOutput(named(NamedKey.ArrowLeft), ctrl, applicationCursorKeys = true))
    }

    @Test
    fun modifierMasksMatchXterm() {
        assertEquals(1, shift.mask)
        assertEquals(2, alt.mask)
        assertEquals(4, ctrl.mask)
        assertEquals(5, KeyboardModifiers(ctrl = true, shift = true).mask)
        assertEquals(7, KeyboardModifiers(ctrl = true, shift = true, alt = true).mask)
    }

    @Test
    fun modifierCombinationsOnArrows() {
        assertEquals("${ESC}[1;3D", resolveKeyOutput(named(NamedKey.ArrowLeft), alt))
        assertEquals("${ESC}[1;2D", resolveKeyOutput(named(NamedKey.ArrowLeft), shift))
        assertEquals("${ESC}[1;7D", resolveKeyOutput(named(NamedKey.ArrowLeft), KeyboardModifiers(ctrl = true, alt = true)))
        assertEquals("${ESC}[1;6D", resolveKeyOutput(named(NamedKey.ArrowLeft), KeyboardModifiers(ctrl = true, shift = true)))
        assertEquals("${ESC}[1;4D", resolveKeyOutput(named(NamedKey.ArrowLeft), KeyboardModifiers(alt = true, shift = true)))
    }

    @Test
    fun modifierCombinationsOnNamedKeys() {
        assertEquals("${ESC}[Z", resolveKeyOutput(named(NamedKey.Tab), shift))
        assertEquals("\u0000", resolveKeyOutput(named(NamedKey.Space), ctrl))
        assertEquals("${ESC} ", resolveKeyOutput(named(NamedKey.Space), alt))
        assertEquals("${ESC}${ESC}", resolveKeyOutput(named(NamedKey.Escape), alt))
        assertEquals("${ESC}\r", resolveKeyOutput(named(NamedKey.Enter), alt))
        assertEquals("\b", resolveKeyOutput(named(NamedKey.Backspace), ctrl))
        assertEquals("${ESC}\u007F", resolveKeyOutput(named(NamedKey.Backspace), alt))
        assertEquals("${ESC}\b", resolveKeyOutput(named(NamedKey.Backspace), KeyboardModifiers(ctrl = true, alt = true)))
        assertEquals("${ESC}[1;5P", resolveKeyOutput(named(NamedKey.F1), ctrl))
        assertEquals("${ESC}[15;3~", resolveKeyOutput(named(NamedKey.F5), alt))
    }

    @Test
    fun deadCombinationsProduceNothing() {
        assertNull(resolveKeyOutput(named(NamedKey.Insert), shift))
        assertNull(resolveKeyOutput(named(NamedKey.Insert), ctrl))
        assertNull(resolveKeyOutput(named(NamedKey.PageUp), shift))
        assertNull(resolveKeyOutput(named(NamedKey.PageDown), shift))
    }

    @Test
    fun modifierAndLayoutKeysProduceNothingByThemselves() {
        val rows = KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Lowercase)
        val modifierKey = rows.first().filterIsInstance<ModifierKey>().first { it.modifier == KeyboardModifier.Ctrl }
        val layoutKey = rows.last().filterIsInstance<LayoutSwitchKey>().first()

        assertNull(resolveKeyOutput(modifierKey))
        assertNull(resolveKeyOutput(modifierKey, ctrl))
        assertNull(resolveKeyOutput(layoutKey))
    }

    @Test
    fun shortcutKeysIgnoreModifiers() {
        val shortcut = KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Shortcuts)
            .flatten()
            .filterIsInstance<ShortcutKey>()
            .first { it.label == "^W" }

        assertEquals("\u0017", resolveKeyOutput(shortcut))
        assertEquals("\u0017", resolveKeyOutput(shortcut, ctrl))
        assertEquals("\u0017", resolveKeyOutput(shortcut, KeyboardModifiers(ctrl = true, shift = true, alt = true)))
    }

    @Test
    fun layoutSwitchesFollowTheReferenceGraph() {
        fun layoutSwitch(layout: KeyboardLayout, label: String) = KEYBOARD_LAYOUTS.getValue(layout)
            .flatten()
            .filterIsInstance<LayoutSwitchKey>()
            .first { it.label == label }

        assertEquals(KeyboardLayout.Uppercase, layoutSwitch(KeyboardLayout.Lowercase, "Caps").target)
        assertEquals(KeyboardLayout.Lowercase, layoutSwitch(KeyboardLayout.Uppercase, "Caps").target)
        assertEquals(KeyboardLayout.Fn, layoutSwitch(KeyboardLayout.Lowercase, "Fn").target)
        assertEquals(KeyboardLayout.Lowercase, layoutSwitch(KeyboardLayout.Fn, "Fn").target)
        assertEquals(KeyboardLayout.Shortcuts, layoutSwitch(KeyboardLayout.Lowercase, "...").target)
        assertEquals(KeyboardLayout.Lowercase, layoutSwitch(KeyboardLayout.Shortcuts, "...").target)
    }

    @Test
    fun keyWidthsMatchTheReferenceGrowTable() {
        val rows = KEYBOARD_LAYOUTS.getValue(KeyboardLayout.Lowercase)
        val caps = rows.flatten().filterIsInstance<LayoutSwitchKey>().first { it.label == "Caps" }
        val space = rows.last().first { it.label == "Space" }
        val backspace = rows.last().first { it.label == "⌫" }
        val enter = rows.last().first { it.label == "Enter" }
        val fn = rows.last().filterIsInstance<LayoutSwitchKey>().first { it.label == "Fn" }
        val normal = rows[1].first()

        assertEquals(1.2f, caps.grow, 0.001f)
        assertEquals(2.8f, space.grow, 0.001f)
        assertEquals(1.8f, backspace.grow, 0.001f)
        assertEquals(1.8f, enter.grow, 0.001f)
        assertEquals(1.1f, fn.grow, 0.001f)
        assertEquals(1f, normal.grow, 0.001f)
    }

    @Test
    fun modifierTogglingIsIndependent() {
        val toggled = KeyboardModifiers()
            .toggled(KeyboardModifier.Ctrl)
            .toggled(KeyboardModifier.Alt)

        assertEquals(KeyboardModifiers(ctrl = true, alt = true), toggled)
        assertEquals(KeyboardModifiers(alt = true), toggled.toggled(KeyboardModifier.Ctrl))
    }
}
