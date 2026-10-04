package com.nashaofu.shell360.feature.terminal

/**
 * Virtual keyboard data mirrored from
 * `packages/shared/src/components/VirtualKeyboard/constants.ts`.
 *
 * The reference resolves every key through xterm's `evaluateKeyboardEvent`; the byte
 * tables below reproduce the documented results (`resolveInput.ts`).
 */
enum class KeyboardModifier { Ctrl, Shift, Alt }

enum class KeyboardLayout { Lowercase, Uppercase, Fn, Shortcuts }

enum class NamedKey(val output: String) {
    Escape("\u001B"),
    Tab("\u0009"),
    Space(" "),
    Backspace("\u007F"),
    Enter("\r"),
    F1("\u001BOP"),
    F2("\u001BOQ"),
    F3("\u001BOR"),
    F4("\u001BOS"),
    F5("\u001B[15~"),
    F6("\u001B[17~"),
    F7("\u001B[18~"),
    F8("\u001B[19~"),
    F9("\u001B[20~"),
    F10("\u001B[21~"),
    F11("\u001B[23~"),
    F12("\u001B[24~"),
    Insert("\u001B[2~"),
    Delete("\u001B[3~"),
    Home("\u001B[H"),
    End("\u001B[F"),
    PageUp("\u001B[5~"),
    PageDown("\u001B[6~"),
    ArrowLeft("\u001B[D"),
    ArrowUp("\u001B[A"),
    ArrowRight("\u001B[C"),
    ArrowDown("\u001B[B"),
}

/** Terminal codes used when a modifier is held (CSI form) or DECCKM is active. */
private val CURSOR_FINAL: Map<NamedKey, Char> = mapOf(
    NamedKey.ArrowLeft to 'D',
    NamedKey.ArrowUp to 'A',
    NamedKey.ArrowRight to 'C',
    NamedKey.ArrowDown to 'B',
    NamedKey.Home to 'H',
    NamedKey.End to 'F',
)

private val FUNCTION_FINAL: Map<NamedKey, Char> = mapOf(
    NamedKey.F1 to 'P',
    NamedKey.F2 to 'Q',
    NamedKey.F3 to 'R',
    NamedKey.F4 to 'S',
)

private val FUNCTION_CODE: Map<NamedKey, Int> = mapOf(
    NamedKey.F5 to 15,
    NamedKey.F6 to 17,
    NamedKey.F7 to 18,
    NamedKey.F8 to 19,
    NamedKey.F9 to 20,
    NamedKey.F10 to 21,
    NamedKey.F11 to 23,
    NamedKey.F12 to 24,
)

sealed interface KeyboardKey {
    val label: String
    val grow: Float
}

data class CharacterKey(
    val char: Char,
    override val grow: Float = 1f,
) : KeyboardKey {
    override val label: String get() = char.toString()
}

data class NamedKeyboardKey(
    val id: NamedKey,
    override val label: String,
    override val grow: Float = 1f,
) : KeyboardKey

data class ModifierKey(
    val modifier: KeyboardModifier,
    override val label: String,
    override val grow: Float = MODIFIER_GROW,
) : KeyboardKey

data class LayoutSwitchKey(
    val target: KeyboardLayout,
    override val label: String,
    override val grow: Float = MODIFIER_GROW,
) : KeyboardKey

data class ShortcutKey(
    val byte: Int,
    override val label: String,
    override val grow: Float = 1f,
) : KeyboardKey

private const val MODIFIER_GROW = 1.2f
private const val LAYOUT_GROW = 1.1f
private const val SPACE_GROW = 2.8f
private const val WIDE_GROW = 1.8f

private fun named(id: NamedKey, label: String, grow: Float = 1f) = NamedKeyboardKey(id, label, grow)

private fun chars(row: String) = row.map { CharacterKey(it) }

private fun row(vararg keys: KeyboardKey) = keys.toList()

private val MODIFIER_ROW = row(
    ModifierKey(KeyboardModifier.Ctrl, "Ctrl"),
    ModifierKey(KeyboardModifier.Shift, "Shift"),
    ModifierKey(KeyboardModifier.Alt, "Alt"),
    named(NamedKey.Escape, "Esc"),
    named(NamedKey.Tab, "Tab"),
)

private val SPACE = named(NamedKey.Space, "Space", SPACE_GROW)
private val BACKSPACE = named(NamedKey.Backspace, "⌫", WIDE_GROW)
private val ENTER = named(NamedKey.Enter, "Enter", WIDE_GROW)

private fun bottomRow(fnTarget: KeyboardLayout, dotsTarget: KeyboardLayout) = row(
    LayoutSwitchKey(fnTarget, "Fn", LAYOUT_GROW),
    LayoutSwitchKey(dotsTarget, "...", LAYOUT_GROW),
    SPACE,
    BACKSPACE,
    ENTER,
)

private val LOWERCASE_ROWS = listOf(
    MODIFIER_ROW,
    chars("1234567890"),
    chars("qwertyuiop"),
    chars("asdfghjkl"),
    row(LayoutSwitchKey(KeyboardLayout.Uppercase, "Caps")) + chars("zxcvbnm"),
    bottomRow(KeyboardLayout.Fn, KeyboardLayout.Shortcuts),
)

private val UPPERCASE_ROWS = listOf(
    MODIFIER_ROW,
    chars("1234567890"),
    chars("QWERTYUIOP"),
    chars("ASDFGHJKL"),
    row(LayoutSwitchKey(KeyboardLayout.Lowercase, "Caps")) + chars("ZXCVBNM"),
    bottomRow(KeyboardLayout.Fn, KeyboardLayout.Shortcuts),
)

private val FN_ROWS = listOf(
    MODIFIER_ROW,
    row(
        named(NamedKey.F1, "F1"), named(NamedKey.F2, "F2"), named(NamedKey.F3, "F3"),
        named(NamedKey.F4, "F4"), named(NamedKey.F5, "F5"), named(NamedKey.F6, "F6"),
        named(NamedKey.F7, "F7"), named(NamedKey.F8, "F8"), named(NamedKey.F9, "F9"),
        named(NamedKey.F10, "F10"),
    ),
    row(
        named(NamedKey.F11, "F11"), named(NamedKey.F12, "F12"),
        named(NamedKey.Insert, "Ins"), named(NamedKey.Delete, "Del"),
        named(NamedKey.Home, "Home"), named(NamedKey.End, "End"),
    ),
    row(
        named(NamedKey.PageUp, "PgUp"), named(NamedKey.PageDown, "PgDn"),
        named(NamedKey.ArrowLeft, "←"), named(NamedKey.ArrowUp, "↑"),
        named(NamedKey.ArrowRight, "→"), named(NamedKey.ArrowDown, "↓"),
    ),
    chars("!@#$%^&*()"),
    chars("`~-_=+"),
    chars("[{}]|\\"),
    chars(";:'\",<.>/?"),
    bottomRow(KeyboardLayout.Lowercase, KeyboardLayout.Shortcuts),
)

private val SHORTCUT_ROWS = listOf(
    MODIFIER_ROW,
    row(
        ShortcutKey(0x17, "^W"), ShortcutKey(0x12, "^R"), ShortcutKey(0x01, "^A"),
        ShortcutKey(0x05, "^E"), ShortcutKey(0x03, "^C"), ShortcutKey(0x0C, "^L"),
    ),
    row(
        ShortcutKey(0x13, "^S"), ShortcutKey(0x1A, "^Z"), ShortcutKey(0x18, "^X"),
        ShortcutKey(0x04, "^D"), ShortcutKey(0x0E, "^N"), ShortcutKey(0x10, "^P"),
    ),
    bottomRow(KeyboardLayout.Fn, KeyboardLayout.Lowercase),
)

/** Key rows per layout, top to bottom. Mirrors `KEYBOARD_ROWS`. */
val KEYBOARD_LAYOUTS: Map<KeyboardLayout, List<List<KeyboardKey>>> = mapOf(
    KeyboardLayout.Lowercase to LOWERCASE_ROWS,
    KeyboardLayout.Uppercase to UPPERCASE_ROWS,
    KeyboardLayout.Fn to FN_ROWS,
    KeyboardLayout.Shortcuts to SHORTCUT_ROWS,
)

data class KeyboardModifiers(
    val ctrl: Boolean = false,
    val shift: Boolean = false,
    val alt: Boolean = false,
) {
    val any: Boolean get() = ctrl || shift || alt

    /** xterm's `modifiers` bitmask: shift 1, alt 2, ctrl 4. */
    val mask: Int
        get() = (if (shift) 1 else 0) or (if (alt) 2 else 0) or (if (ctrl) 4 else 0)

    fun toggled(modifier: KeyboardModifier): KeyboardModifiers = when (modifier) {
        KeyboardModifier.Ctrl -> copy(ctrl = !ctrl)
        KeyboardModifier.Shift -> copy(shift = !shift)
        KeyboardModifier.Alt -> copy(alt = !alt)
    }
}

private val SHIFTED_DIGITS: Map<Char, Char> = mapOf(
    '1' to '!', '2' to '@', '3' to '#', '4' to '$', '5' to '%',
    '6' to '^', '7' to '&', '8' to '*', '9' to '(', '0' to ')',
)

private val CTRL_PUNCTUATION: Map<Char, Int> = mapOf(
    '[' to 0x1B, '\\' to 0x1C, ']' to 0x1D, '/' to 0x1F,
    '_' to 0x1F, '@' to 0x00, '^' to 0x1E,
)

private fun escapeByte(): Char = '\u001B'

/**
 * Resolves the bytes a key sends, or `null` when the combination produces no output
 * (modifier/layout switches, and the documented dead combinations).
 */
fun resolveKeyOutput(
    key: KeyboardKey,
    modifiers: KeyboardModifiers = KeyboardModifiers(),
    applicationCursorKeys: Boolean = false,
): String? = when (key) {
    is ModifierKey, is LayoutSwitchKey -> null
    is ShortcutKey -> key.byte.toChar().toString()
    is CharacterKey -> resolveCharacter(key.char, modifiers)
    is NamedKeyboardKey -> resolveNamed(key.id, modifiers, applicationCursorKeys)
}

private fun resolveCharacter(char: Char, modifiers: KeyboardModifiers): String? {
    if (modifiers.ctrl) {
        val code = when {
            char.isLetter() -> char.uppercaseChar().code - 'A'.code + 1
            char == ' ' -> 0x00
            else -> CTRL_PUNCTUATION[char] ?: return null
        }
        val body = code.toChar().toString()
        return if (modifiers.alt) escapeByte() + body else body
    }

    val base = if (modifiers.shift) SHIFTED_DIGITS[char] ?: char.uppercaseChar() else char
    return if (modifiers.alt) "${escapeByte()}$base" else base.toString()
}

private fun resolveNamed(
    id: NamedKey,
    modifiers: KeyboardModifiers,
    applicationCursorKeys: Boolean,
): String? {
    val csi = { final: Char -> "${escapeByte()}[1;${modifiers.mask + 1}$final" }

    // Documented dead combinations: Shift/Ctrl + Ins, Shift + PgUp/PgDn.
    if (id == NamedKey.Insert && (modifiers.shift || modifiers.ctrl)) return null
    if ((id == NamedKey.PageUp || id == NamedKey.PageDown) && modifiers.shift) return null

    CURSOR_FINAL[id]?.let { final ->
        return when {
            modifiers.any -> csi(final)
            applicationCursorKeys -> "${escapeByte()}O$final"
            else -> "${escapeByte()}[$final"
        }
    }

    FUNCTION_FINAL[id]?.let { final ->
        return if (modifiers.any) csi(final) else "${escapeByte()}O$final"
    }

    FUNCTION_CODE[id]?.let { code ->
        return if (modifiers.any) {
            "${escapeByte()}[$code;${modifiers.mask + 1}~"
        } else {
            "${escapeByte()}[$code~"
        }
    }

    return when (id) {
        NamedKey.Escape -> if (modifiers.alt) "${escapeByte()}${escapeByte()}" else escapeByte().toString()
        NamedKey.Tab -> if (modifiers.shift) "${escapeByte()}[Z" else id.output
        NamedKey.Space -> when {
            modifiers.ctrl -> 0x00.toChar().toString()
            modifiers.alt -> "${escapeByte()} "
            else -> id.output
        }

        NamedKey.Backspace -> when {
            modifiers.ctrl && modifiers.alt -> "${escapeByte()}${0x08.toChar()}"
            modifiers.ctrl -> 0x08.toChar().toString()
            modifiers.alt -> "${escapeByte()}${id.output}"
            else -> id.output
        }

        NamedKey.Enter -> if (modifiers.alt) "${escapeByte()}${id.output}" else id.output
        else -> id.output
    }
}
