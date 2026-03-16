/**
 * Unit tests for resolveInput.
 * Covers token-based virtual keyboard input mapping built on top of
 * evaluateKeyboardEvent.
 */
import { describe, expect, it } from "@rstest/core";
import type { KeyboardModifiers } from "../resolveInput";
import { resolveInput } from "../resolveInput";

// Convenience alias for resolveInput tests
function ri(
  token: string,
  mods: KeyboardModifiers = {},
  appCursor = false,
): string | null {
  return resolveInput(token, mods, appCursor);
}

// ═══════════════════════════════════════════════════════════════
// resolveInput — token-based virtual keyboard tests
// ═══════════════════════════════════════════════════════════════
describe("resolveInput", () => {
  // ─────────────────────────────────────────────────────────────
  // Unmodified special keys
  // ─────────────────────────────────────────────────────────────
  describe("should return the correct escape sequence for unmodified keys", () => {
    it("Backspace → \\x7f", () => {
      expect(ri("⌫")).toBe("\x7f");
    });

    it("Tab → \\t", () => {
      expect(ri("Tab")).toBe("\t");
    });

    it("Enter → \\r", () => {
      expect(ri("Enter")).toBe("\r");
    });

    it("Esc → \\x1b", () => {
      expect(ri("Esc")).toBe("\x1b");
    });

    it("Space → ' '", () => {
      expect(ri("Space")).toBe(" ");
    });

    it("Insert → \\x1b[2~ (CSI 2 ~)", () => {
      expect(ri("Ins")).toBe("\x1b[2~");
    });

    it("Delete → \\x1b[3~ (CSI 3 ~)", () => {
      expect(ri("Del")).toBe("\x1b[3~");
    });

    it("Home → \\x1b[H", () => {
      expect(ri("Home")).toBe("\x1b[H");
    });

    it("End → \\x1b[F", () => {
      expect(ri("End")).toBe("\x1b[F");
    });

    it("PgUp → \\x1b[5~ (CSI 5 ~)", () => {
      expect(ri("PgUp")).toBe("\x1b[5~");
    });

    it("PgDn → \\x1b[6~ (CSI 6 ~)", () => {
      expect(ri("PgDn")).toBe("\x1b[6~");
    });

    it("← → \\x1b[D (CSI D)", () => {
      expect(ri("←")).toBe("\x1b[D");
    });

    it("↑ → \\x1b[A (CSI A)", () => {
      expect(ri("↑")).toBe("\x1b[A");
    });

    it("→ → \\x1b[C (CSI C)", () => {
      expect(ri("→")).toBe("\x1b[C");
    });

    it("↓ → \\x1b[B (CSI B)", () => {
      expect(ri("↓")).toBe("\x1b[B");
    });

    it("F1 → \\x1bOP (SS3 P)", () => {
      expect(ri("F1")).toBe("\x1bOP");
    });

    it("F2 → \\x1bOQ (SS3 Q)", () => {
      expect(ri("F2")).toBe("\x1bOQ");
    });

    it("F3 → \\x1bOR (SS3 R)", () => {
      expect(ri("F3")).toBe("\x1bOR");
    });

    it("F4 → \\x1bOS (SS3 S)", () => {
      expect(ri("F4")).toBe("\x1bOS");
    });

    it("F5 → \\x1b[15~ (CSI 15 ~)", () => {
      expect(ri("F5")).toBe("\x1b[15~");
    });

    it("F6 → \\x1b[17~ (CSI 17 ~)", () => {
      expect(ri("F6")).toBe("\x1b[17~");
    });

    it("F7 → \\x1b[18~ (CSI 18 ~)", () => {
      expect(ri("F7")).toBe("\x1b[18~");
    });

    it("F8 → \\x1b[19~ (CSI 19 ~)", () => {
      expect(ri("F8")).toBe("\x1b[19~");
    });

    it("F9 → \\x1b[20~ (CSI 20 ~)", () => {
      expect(ri("F9")).toBe("\x1b[20~");
    });

    it("F10 → \\x1b[21~ (CSI 21 ~)", () => {
      expect(ri("F10")).toBe("\x1b[21~");
    });

    it("F11 → \\x1b[23~ (CSI 23 ~)", () => {
      expect(ri("F11")).toBe("\x1b[23~");
    });

    it("F12 → \\x1b[24~ (CSI 24 ~)", () => {
      expect(ri("F12")).toBe("\x1b[24~");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // applicationCursorKeysMode (DECCKM)
  // ─────────────────────────────────────────────────────────────
  describe("applicationCursorKeysMode", () => {
    it("← in application mode → \\x1bOD (SS3 D)", () => {
      expect(ri("←", {}, true)).toBe("\x1bOD");
    });

    it("↑ in application mode → \\x1bOA (SS3 A)", () => {
      expect(ri("↑", {}, true)).toBe("\x1bOA");
    });

    it("→ in application mode → \\x1bOC (SS3 C)", () => {
      expect(ri("→", {}, true)).toBe("\x1bOC");
    });

    it("↓ in application mode → \\x1bOB (SS3 B)", () => {
      expect(ri("↓", {}, true)).toBe("\x1bOB");
    });

    it("Home in application mode → \\x1bOH (SS3 H)", () => {
      expect(ri("Home", {}, true)).toBe("\x1bOH");
    });

    it("End in application mode → \\x1bOF (SS3 F)", () => {
      expect(ri("End", {}, true)).toBe("\x1bOF");
    });

    it("modifier overrides application mode: Ctrl+← → \\x1b[1;5D", () => {
      expect(ri("←", { Ctrl: true }, true)).toBe("\x1b[1;5D");
    });

    it("modifier overrides application mode: Ctrl+↑ → \\x1b[1;5A", () => {
      expect(ri("↑", { Ctrl: true }, true)).toBe("\x1b[1;5A");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Ctrl modifier
  // ─────────────────────────────────────────────────────────────
  describe("Ctrl modifier", () => {
    it("Ctrl+Backspace → \\x08 (BS)", () => {
      expect(ri("⌫", { Ctrl: true })).toBe("\x08");
    });

    it("Ctrl+← → \\x1b[1;5D", () => {
      expect(ri("←", { Ctrl: true })).toBe("\x1b[1;5D");
    });

    it("Ctrl+→ → \\x1b[1;5C", () => {
      expect(ri("→", { Ctrl: true })).toBe("\x1b[1;5C");
    });

    it("Ctrl+↑ → \\x1b[1;5A", () => {
      expect(ri("↑", { Ctrl: true })).toBe("\x1b[1;5A");
    });

    it("Ctrl+↓ → \\x1b[1;5B", () => {
      expect(ri("↓", { Ctrl: true })).toBe("\x1b[1;5B");
    });

    it("Ctrl+Delete → \\x1b[3;5~", () => {
      expect(ri("Del", { Ctrl: true })).toBe("\x1b[3;5~");
    });

    it("Ctrl+a → \\x01", () => {
      expect(ri("a", { Ctrl: true })).toBe("\x01");
    });

    it("Ctrl+z → \\x1a", () => {
      expect(ri("z", { Ctrl: true })).toBe("\x1a");
    });

    it("Ctrl+Space → \\x00 (NUL)", () => {
      expect(ri("Space", { Ctrl: true })).toBe("\x00");
    });

    it("Ctrl+[ → \\x1b (ESC)", () => {
      expect(ri("[", { Ctrl: true })).toBe("\x1b");
    });

    it("Ctrl+\\ → \\x1c (FS)", () => {
      expect(ri("\\", { Ctrl: true })).toBe("\x1c");
    });

    it("Ctrl+] → \\x1d (GS)", () => {
      expect(ri("]", { Ctrl: true })).toBe("\x1d");
    });

    it("Ctrl+/ → \\x1f (US)", () => {
      expect(ri("/", { Ctrl: true })).toBe("\x1f");
    });

    it("Ctrl+@ → \\x00 (NUL)", () => {
      expect(ri("@", { Ctrl: true })).toBe("\x00");
    });

    it("Ctrl+^ → \\x1e (RS)", () => {
      expect(ri("^", { Ctrl: true })).toBe("\x1e");
    });

    it("Ctrl+_ → \\x1f (US)", () => {
      expect(ri("_", { Ctrl: true })).toBe("\x1f");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Alt modifier
  // ─────────────────────────────────────────────────────────────
  describe("Alt modifier", () => {
    it("Alt+Backspace → \\x1b\\x7f", () => {
      expect(ri("⌫", { Alt: true })).toBe("\x1b\x7f");
    });

    it("Alt+Enter → \\x1b\\r", () => {
      expect(ri("Enter", { Alt: true })).toBe("\x1b\r");
    });

    it("Alt+Esc → \\x1b\\x1b", () => {
      expect(ri("Esc", { Alt: true })).toBe("\x1b\x1b");
    });

    it("Alt+Space → \\x1b\\x20", () => {
      expect(ri("Space", { Alt: true })).toBe("\x1b\x20");
    });

    it("Alt+← → \\x1b[1;3D", () => {
      expect(ri("←", { Alt: true })).toBe("\x1b[1;3D");
    });

    it("Alt+→ → \\x1b[1;3C", () => {
      expect(ri("→", { Alt: true })).toBe("\x1b[1;3C");
    });

    it("Alt+↑ → \\x1b[1;3A", () => {
      expect(ri("↑", { Alt: true })).toBe("\x1b[1;3A");
    });

    it("Alt+↓ → \\x1b[1;3B", () => {
      expect(ri("↓", { Alt: true })).toBe("\x1b[1;3B");
    });

    it("Alt+Delete → \\x1b[3;3~", () => {
      expect(ri("Del", { Alt: true })).toBe("\x1b[3;3~");
    });

    it("Alt+a → \\x1ba", () => {
      expect(ri("a", { Alt: true })).toBe("\x1ba");
    });

    // Numbers with Alt
    it("Alt+0 → \\x1b0", () => {
      expect(ri("0", { Alt: true })).toBe("\x1b0");
    });

    it("Alt+1 → \\x1b1", () => {
      expect(ri("1", { Alt: true })).toBe("\x1b1");
    });

    it("Alt+9 → \\x1b9", () => {
      expect(ri("9", { Alt: true })).toBe("\x1b9");
    });

    // Special chars with Alt
    it("Alt+; → \\x1b;", () => {
      expect(ri(";", { Alt: true })).toBe("\x1b;");
    });

    it("Alt+= → \\x1b=", () => {
      expect(ri("=", { Alt: true })).toBe("\x1b=");
    });

    it("Alt+, → \\x1b,", () => {
      expect(ri(",", { Alt: true })).toBe("\x1b,");
    });

    it("Alt+- → \\x1b-", () => {
      expect(ri("-", { Alt: true })).toBe("\x1b-");
    });

    it("Alt+. → \\x1b.", () => {
      expect(ri(".", { Alt: true })).toBe("\x1b.");
    });

    it("Alt+/ → \\x1b/", () => {
      expect(ri("/", { Alt: true })).toBe("\x1b/");
    });

    it("Alt+` → \\x1b`", () => {
      expect(ri("`", { Alt: true })).toBe("\x1b`");
    });

    it("Alt+[ → \\x1b[", () => {
      expect(ri("[", { Alt: true })).toBe("\x1b[");
    });

    it("Alt+\\ → \\x1b\\\\", () => {
      expect(ri("\\", { Alt: true })).toBe("\x1b\\");
    });

    it("Alt+] → \\x1b]", () => {
      expect(ri("]", { Alt: true })).toBe("\x1b]");
    });

    it("Alt+' → \\x1b'", () => {
      expect(ri("'", { Alt: true })).toBe("\x1b'");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Shift modifier
  // ─────────────────────────────────────────────────────────────
  describe("Shift modifier", () => {
    it("Shift+Tab → \\x1b[Z (reverse tab)", () => {
      expect(ri("Tab", { Shift: true })).toBe("\x1b[Z");
    });

    it("Shift+Delete → \\x1b[3;2~", () => {
      expect(ri("Del", { Shift: true })).toBe("\x1b[3;2~");
    });

    it("Shift+PgUp → null (terminal scroll, not a sequence)", () => {
      expect(ri("PgUp", { Shift: true })).toBeNull();
    });

    it("Shift+PgDn → null (terminal scroll, not a sequence)", () => {
      expect(ri("PgDn", { Shift: true })).toBeNull();
    });

    it("Shift+Ins → null (copy/paste, not a sequence)", () => {
      expect(ri("Ins", { Shift: true })).toBeNull();
    });

    it("Shift+letter toggles case: 'a' with Shift → 'A'", () => {
      expect(ri("a", { Shift: true })).toBe("A");
    });

    it("Shift+uppercase toggles case: 'A' with Shift → 'a'", () => {
      expect(ri("A", { Shift: true })).toBe("a");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Ctrl+Alt combinations
  // ─────────────────────────────────────────────────────────────
  describe("Ctrl+Alt combinations", () => {
    it("Ctrl+Alt+Backspace → \\x1b\\x08", () => {
      expect(ri("⌫", { Ctrl: true, Alt: true })).toBe("\x1b\x08");
    });

    it("Ctrl+Alt+a → \\x1b\\x01", () => {
      expect(ri("a", { Ctrl: true, Alt: true })).toBe("\x1b\x01");
    });

    it("Ctrl+Alt+Space → \\x1b\\x00", () => {
      expect(ri("Space", { Ctrl: true, Alt: true })).toBe("\x1b\x00");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Alt+Shift combinations
  // ─────────────────────────────────────────────────────────────
  describe("Alt+Shift combinations", () => {
    it("Alt+Shift+a → \\x1bA (uppercase with ESC prefix)", () => {
      expect(ri("a", { Alt: true, Shift: true })).toBe("\x1bA");
    });

    it("Alt+Shift+z → \\x1bZ", () => {
      expect(ri("z", { Alt: true, Shift: true })).toBe("\x1bZ");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Modified F1–F12 keys
  // ─────────────────────────────────────────────────────────────
  describe("should return the correct escape sequence for modified F1–F12 keys", () => {
    // Shift+F1–F4
    it("Shift+F1 → \\x1b[1;2P", () => {
      expect(ri("F1", { Shift: true })).toBe("\x1b[1;2P");
    });

    it("Shift+F2 → \\x1b[1;2Q", () => {
      expect(ri("F2", { Shift: true })).toBe("\x1b[1;2Q");
    });

    it("Shift+F3 → \\x1b[1;2R", () => {
      expect(ri("F3", { Shift: true })).toBe("\x1b[1;2R");
    });

    it("Shift+F4 → \\x1b[1;2S", () => {
      expect(ri("F4", { Shift: true })).toBe("\x1b[1;2S");
    });

    // Shift+F5–F12
    it("Shift+F5 → \\x1b[15;2~", () => {
      expect(ri("F5", { Shift: true })).toBe("\x1b[15;2~");
    });

    it("Shift+F6 → \\x1b[17;2~", () => {
      expect(ri("F6", { Shift: true })).toBe("\x1b[17;2~");
    });

    it("Shift+F7 → \\x1b[18;2~", () => {
      expect(ri("F7", { Shift: true })).toBe("\x1b[18;2~");
    });

    it("Shift+F8 → \\x1b[19;2~", () => {
      expect(ri("F8", { Shift: true })).toBe("\x1b[19;2~");
    });

    it("Shift+F9 → \\x1b[20;2~", () => {
      expect(ri("F9", { Shift: true })).toBe("\x1b[20;2~");
    });

    it("Shift+F10 → \\x1b[21;2~", () => {
      expect(ri("F10", { Shift: true })).toBe("\x1b[21;2~");
    });

    it("Shift+F11 → \\x1b[23;2~", () => {
      expect(ri("F11", { Shift: true })).toBe("\x1b[23;2~");
    });

    it("Shift+F12 → \\x1b[24;2~", () => {
      expect(ri("F12", { Shift: true })).toBe("\x1b[24;2~");
    });

    // Alt+F1–F4
    it("Alt+F1 → \\x1b[1;3P", () => {
      expect(ri("F1", { Alt: true })).toBe("\x1b[1;3P");
    });

    it("Alt+F2 → \\x1b[1;3Q", () => {
      expect(ri("F2", { Alt: true })).toBe("\x1b[1;3Q");
    });

    it("Alt+F3 → \\x1b[1;3R", () => {
      expect(ri("F3", { Alt: true })).toBe("\x1b[1;3R");
    });

    it("Alt+F4 → \\x1b[1;3S", () => {
      expect(ri("F4", { Alt: true })).toBe("\x1b[1;3S");
    });

    // Alt+F5–F12
    it("Alt+F5 → \\x1b[15;3~", () => {
      expect(ri("F5", { Alt: true })).toBe("\x1b[15;3~");
    });

    it("Alt+F6 → \\x1b[17;3~", () => {
      expect(ri("F6", { Alt: true })).toBe("\x1b[17;3~");
    });

    it("Alt+F7 → \\x1b[18;3~", () => {
      expect(ri("F7", { Alt: true })).toBe("\x1b[18;3~");
    });

    it("Alt+F8 → \\x1b[19;3~", () => {
      expect(ri("F8", { Alt: true })).toBe("\x1b[19;3~");
    });

    it("Alt+F9 → \\x1b[20;3~", () => {
      expect(ri("F9", { Alt: true })).toBe("\x1b[20;3~");
    });

    it("Alt+F10 → \\x1b[21;3~", () => {
      expect(ri("F10", { Alt: true })).toBe("\x1b[21;3~");
    });

    it("Alt+F11 → \\x1b[23;3~", () => {
      expect(ri("F11", { Alt: true })).toBe("\x1b[23;3~");
    });

    it("Alt+F12 → \\x1b[24;3~", () => {
      expect(ri("F12", { Alt: true })).toBe("\x1b[24;3~");
    });

    // Ctrl+F1–F4
    it("Ctrl+F1 → \\x1b[1;5P", () => {
      expect(ri("F1", { Ctrl: true })).toBe("\x1b[1;5P");
    });

    it("Ctrl+F2 → \\x1b[1;5Q", () => {
      expect(ri("F2", { Ctrl: true })).toBe("\x1b[1;5Q");
    });

    it("Ctrl+F3 → \\x1b[1;5R", () => {
      expect(ri("F3", { Ctrl: true })).toBe("\x1b[1;5R");
    });

    it("Ctrl+F4 → \\x1b[1;5S", () => {
      expect(ri("F4", { Ctrl: true })).toBe("\x1b[1;5S");
    });

    // Ctrl+F5–F12
    it("Ctrl+F5 → \\x1b[15;5~", () => {
      expect(ri("F5", { Ctrl: true })).toBe("\x1b[15;5~");
    });

    it("Ctrl+F6 → \\x1b[17;5~", () => {
      expect(ri("F6", { Ctrl: true })).toBe("\x1b[17;5~");
    });

    it("Ctrl+F7 → \\x1b[18;5~", () => {
      expect(ri("F7", { Ctrl: true })).toBe("\x1b[18;5~");
    });

    it("Ctrl+F8 → \\x1b[19;5~", () => {
      expect(ri("F8", { Ctrl: true })).toBe("\x1b[19;5~");
    });

    it("Ctrl+F9 → \\x1b[20;5~", () => {
      expect(ri("F9", { Ctrl: true })).toBe("\x1b[20;5~");
    });

    it("Ctrl+F10 → \\x1b[21;5~", () => {
      expect(ri("F10", { Ctrl: true })).toBe("\x1b[21;5~");
    });

    it("Ctrl+F11 → \\x1b[23;5~", () => {
      expect(ri("F11", { Ctrl: true })).toBe("\x1b[23;5~");
    });

    it("Ctrl+F12 → \\x1b[24;5~", () => {
      expect(ri("F12", { Ctrl: true })).toBe("\x1b[24;5~");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Printable characters
  // ─────────────────────────────────────────────────────────────
  describe("printable characters", () => {
    it("lowercase letter → same letter", () => {
      expect(ri("a")).toBe("a");
    });

    it("digit → same digit", () => {
      expect(ri("1")).toBe("1");
    });

    it("uppercase letter (unmodified) → same letter", () => {
      expect(ri("A")).toBe("A");
    });

    it("Alt+Shift+a → \\x1bA (uppercase ESC-prefixed)", () => {
      expect(ri("a", { Alt: true, Shift: true })).toBe("\x1bA");
    });

    it("Alt+Shift+h → \\x1bH", () => {
      expect(ri("h", { Alt: true, Shift: true })).toBe("\x1bH");
    });

    it("Alt+Shift+z → \\x1bZ", () => {
      expect(ri("z", { Alt: true, Shift: true })).toBe("\x1bZ");
    });

    it("Alt+a (no shift) → \\x1ba (lowercase ESC-prefixed)", () => {
      expect(ri("a", { Alt: true, Shift: false })).toBe("\x1ba");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Ctrl shortcut tokens (Shortcuts layout: ^A, ^C, …)
  // ─────────────────────────────────────────────────────────────
  describe("Ctrl shortcut tokens", () => {
    it("^A → \\x01", () => {
      expect(ri("^A")).toBe("\x01");
    });

    it("^C → \\x03", () => {
      expect(ri("^C")).toBe("\x03");
    });

    it("^D → \\x04", () => {
      expect(ri("^D")).toBe("\x04");
    });

    it("^E → \\x05", () => {
      expect(ri("^E")).toBe("\x05");
    });

    it("^L → \\x0c", () => {
      expect(ri("^L")).toBe("\x0c");
    });

    it("^N → \\x0e", () => {
      expect(ri("^N")).toBe("\x0e");
    });

    it("^P → \\x10", () => {
      expect(ri("^P")).toBe("\x10");
    });

    it("^R → \\x12", () => {
      expect(ri("^R")).toBe("\x12");
    });

    it("^S → \\x13", () => {
      expect(ri("^S")).toBe("\x13");
    });

    it("^W → \\x17", () => {
      expect(ri("^W")).toBe("\x17");
    });

    it("^X → \\x18", () => {
      expect(ri("^X")).toBe("\x18");
    });

    it("^Z → \\x1a", () => {
      expect(ri("^Z")).toBe("\x1a");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tokens that should produce no input (return null)
  // ─────────────────────────────────────────────────────────────
  describe("tokens that produce no input", () => {
    it("Shift+Insert → null", () => {
      expect(ri("Ins", { Shift: true })).toBeNull();
    });

    it("Ctrl+Insert → null", () => {
      expect(ri("Ins", { Ctrl: true })).toBeNull();
    });

    it("Shift+PgUp → null", () => {
      expect(ri("PgUp", { Shift: true })).toBeNull();
    });

    it("Shift+PgDn → null", () => {
      expect(ri("PgDn", { Shift: true })).toBeNull();
    });

    it("unknown multi-char token → null", () => {
      expect(ri("UnknownToken")).toBeNull();
    });
  });
});
