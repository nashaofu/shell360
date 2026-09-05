/**
 * Unit tests for evaluateKeyboardEvent.
 * Mirrors xterm.js Keyboard.test.ts for complete coverage.
 * @see https://github.com/xtermjs/xterm.js/blob/master/src/common/input/Keyboard.test.ts
 */
import { describe, expect, it } from "@rstest/core";

import type { IKeyboardEvent, IKeyboardResult } from "../xterm/Keyboard";
import { evaluateKeyboardEvent } from "../xterm/Keyboard";

/**
 * A helper function for testing which allows passing in a partial event
 * and defaults will be filled in on it.
 */
function testEvaluateKeyboardEvent(
  partialEvent: {
    altKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    keyCode?: number;
    code?: string;
    key?: string;
    type?: string;
  },
  partialOptions: {
    applicationCursorMode?: boolean;
    isMac?: boolean;
    macOptionIsMeta?: boolean;
  } = {},
): IKeyboardResult {
  const event: IKeyboardEvent = {
    altKey: partialEvent.altKey || false,
    ctrlKey: partialEvent.ctrlKey || false,
    shiftKey: partialEvent.shiftKey || false,
    metaKey: partialEvent.metaKey || false,
    keyCode: partialEvent.keyCode ?? 0,
    code: partialEvent.code || "",
    key: partialEvent.key || "",
    type: partialEvent.type || "",
  };
  const options = {
    applicationCursorMode: partialOptions.applicationCursorMode || false,
    isMac: partialOptions.isMac || false,
    macOptionIsMeta: partialOptions.macOptionIsMeta || false,
  };
  return evaluateKeyboardEvent(
    event,
    options.applicationCursorMode,
    options.isMac,
    options.macOptionIsMeta,
  );
}

describe("evaluateKeyboardEvent", () => {
  describe("escape sequences", () => {
    it("should return the correct escape sequence for unmodified keys", () => {
      expect(testEvaluateKeyboardEvent({ keyCode: 8 }).key).toBe("\x7f");
      expect(testEvaluateKeyboardEvent({ keyCode: 9 }).key).toBe("\t");
      expect(testEvaluateKeyboardEvent({ keyCode: 13 }).key).toBe("\r");
      expect(testEvaluateKeyboardEvent({ keyCode: 27 }).key).toBe("\x1b");
      expect(testEvaluateKeyboardEvent({ keyCode: 33 }).key).toBe("\x1b[5~");
      expect(testEvaluateKeyboardEvent({ keyCode: 34 }).key).toBe("\x1b[6~");
      expect(testEvaluateKeyboardEvent({ keyCode: 35 }).key).toBe("\x1b[F");
      expect(testEvaluateKeyboardEvent({ keyCode: 36 }).key).toBe("\x1b[H");
      expect(testEvaluateKeyboardEvent({ keyCode: 37 }).key).toBe("\x1b[D");
      expect(testEvaluateKeyboardEvent({ keyCode: 38 }).key).toBe("\x1b[A");
      expect(testEvaluateKeyboardEvent({ keyCode: 39 }).key).toBe("\x1b[C");
      expect(testEvaluateKeyboardEvent({ keyCode: 40 }).key).toBe("\x1b[B");
      expect(testEvaluateKeyboardEvent({ keyCode: 45 }).key).toBe("\x1b[2~");
      expect(testEvaluateKeyboardEvent({ keyCode: 46 }).key).toBe("\x1b[3~");
      expect(testEvaluateKeyboardEvent({ keyCode: 112 }).key).toBe("\x1bOP");
      expect(testEvaluateKeyboardEvent({ keyCode: 113 }).key).toBe("\x1bOQ");
      expect(testEvaluateKeyboardEvent({ keyCode: 114 }).key).toBe("\x1bOR");
      expect(testEvaluateKeyboardEvent({ keyCode: 115 }).key).toBe("\x1bOS");
      expect(testEvaluateKeyboardEvent({ keyCode: 116 }).key).toBe("\x1b[15~");
      expect(testEvaluateKeyboardEvent({ keyCode: 117 }).key).toBe("\x1b[17~");
      expect(testEvaluateKeyboardEvent({ keyCode: 118 }).key).toBe("\x1b[18~");
      expect(testEvaluateKeyboardEvent({ keyCode: 119 }).key).toBe("\x1b[19~");
      expect(testEvaluateKeyboardEvent({ keyCode: 120 }).key).toBe("\x1b[20~");
      expect(testEvaluateKeyboardEvent({ keyCode: 121 }).key).toBe("\x1b[21~");
      expect(testEvaluateKeyboardEvent({ keyCode: 122 }).key).toBe("\x1b[23~");
      expect(testEvaluateKeyboardEvent({ keyCode: 123 }).key).toBe("\x1b[24~");
    });

    it("should return \\x1b[3;5~ for ctrl+delete", () => {
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 46 }).key,
      ).toBe("\x1b[3;5~");
    });

    it("should return \\x1b[3;2~ for shift+delete", () => {
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 46 }).key,
      ).toBe("\x1b[3;2~");
    });

    it("should return \\x1b[3;3~ for alt+delete", () => {
      expect(testEvaluateKeyboardEvent({ altKey: true, keyCode: 46 }).key).toBe(
        "\x1b[3;3~",
      );
    });

    it("should return \\x1b\\r for alt+enter", () => {
      expect(testEvaluateKeyboardEvent({ altKey: true, keyCode: 13 }).key).toBe(
        "\x1b\r",
      );
    });

    it("should return \\x1b\\x1b for alt+esc", () => {
      expect(testEvaluateKeyboardEvent({ altKey: true, keyCode: 27 }).key).toBe(
        "\x1b\x1b",
      );
    });

    it("should return \\x1b[1;5D for ctrl+left", () => {
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 37 }).key,
      ).toBe("\x1b[1;5D");
    });

    it("should return \\x1b[1;5C for ctrl+right", () => {
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 39 }).key,
      ).toBe("\x1b[1;5C");
    });

    it("should return \\x1b[1;5A for ctrl+up", () => {
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 38 }).key,
      ).toBe("\x1b[1;5A");
    });

    it("should return \\x1b[1;5B for ctrl+down", () => {
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 40 }).key,
      ).toBe("\x1b[1;5B");
    });

    it("should return \\x08 for ctrl+backspace", () => {
      expect(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 8 }).key).toBe(
        "\x08",
      );
    });

    it("should return \\x1b\\x7f for alt+backspace", () => {
      expect(testEvaluateKeyboardEvent({ altKey: true, keyCode: 8 }).key).toBe(
        "\x1b\x7f",
      );
    });

    it("should return \\x1b\\x08 for ctrl+alt+backspace", () => {
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, altKey: true, keyCode: 8 })
          .key,
      ).toBe("\x1b\x08");
    });

    describe("On non-macOS platforms", () => {
      it("should return \\x1b[1;3D for alt+left", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 37 },
            { isMac: false },
          ).key,
        ).toBe("\x1b[1;3D");
      });

      it("should return \\x1b[1;3C for alt+right", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 39 },
            { isMac: false },
          ).key,
        ).toBe("\x1b[1;3C");
      });

      it("should return \\x1b[1;3A for alt+up", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 38 },
            { isMac: false },
          ).key,
        ).toBe("\x1b[1;3A");
      });

      it("should return \\x1b[1;3B for alt+down", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 40 },
            { isMac: false },
          ).key,
        ).toBe("\x1b[1;3B");
      });

      it("should return \\x1ba for alt+a", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 65 },
            { isMac: false },
          ).key,
        ).toBe("\x1ba");
      });

      it("should return \\x1b\\x20 for alt+space", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 32 },
            { isMac: false },
          ).key,
        ).toBe("\x1b\x20");
      });

      it("should return \\x1b\\x00 for ctrl+alt+space", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, ctrlKey: true, keyCode: 32 },
            { isMac: false },
          ).key,
        ).toBe("\x1b\x00");
      });
    });

    describe("On macOS platforms", () => {
      it("should return \\x1b[1;3D for alt+left", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 37 },
            { isMac: true },
          ).key,
        ).toBe("\x1b[1;3D");
      });

      it("should return \\x1b[1;3C for alt+right", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 39 },
            { isMac: true },
          ).key,
        ).toBe("\x1b[1;3C");
      });

      it("should return \\x1b[1;3A for alt+up", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 38 },
            { isMac: true },
          ).key,
        ).toBe("\x1b[1;3A");
      });

      it("should return \\x1b[1;3B for alt+down", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 40 },
            { isMac: true },
          ).key,
        ).toBe("\x1b[1;3B");
      });

      it("should return undefined for alt+a", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 65 },
            { isMac: true },
          ).key,
        ).toBeUndefined();
      });
    });

    describe("with macOptionIsMeta", () => {
      it("should return \\x1ba for alt+a", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 65 },
            { isMac: true, macOptionIsMeta: true },
          ).key,
        ).toBe("\x1ba");
      });

      it("should return \\x1b\\r for alt+enter", () => {
        expect(
          testEvaluateKeyboardEvent(
            { altKey: true, keyCode: 13 },
            { isMac: true, macOptionIsMeta: true },
          ).key,
        ).toBe("\x1b\r");
      });
    });

    it("should return \\x1b[1;3A for alt+up", () => {
      expect(testEvaluateKeyboardEvent({ altKey: true, keyCode: 38 }).key).toBe(
        "\x1b[1;3A",
      );
    });

    it("should return \\x1b[1;3B for alt+down", () => {
      expect(testEvaluateKeyboardEvent({ altKey: true, keyCode: 40 }).key).toBe(
        "\x1b[1;3B",
      );
    });

    it("should return the correct escape sequence for modified F1-F12 keys", () => {
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 112 }).key,
      ).toBe("\x1b[1;2P");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 113 }).key,
      ).toBe("\x1b[1;2Q");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 114 }).key,
      ).toBe("\x1b[1;2R");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 115 }).key,
      ).toBe("\x1b[1;2S");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 116 }).key,
      ).toBe("\x1b[15;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 117 }).key,
      ).toBe("\x1b[17;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 118 }).key,
      ).toBe("\x1b[18;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 119 }).key,
      ).toBe("\x1b[19;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 120 }).key,
      ).toBe("\x1b[20;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 121 }).key,
      ).toBe("\x1b[21;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 122 }).key,
      ).toBe("\x1b[23;2~");
      expect(
        testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 123 }).key,
      ).toBe("\x1b[24;2~");

      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 112 }).key,
      ).toBe("\x1b[1;3P");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 113 }).key,
      ).toBe("\x1b[1;3Q");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 114 }).key,
      ).toBe("\x1b[1;3R");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 115 }).key,
      ).toBe("\x1b[1;3S");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 116 }).key,
      ).toBe("\x1b[15;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 117 }).key,
      ).toBe("\x1b[17;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 118 }).key,
      ).toBe("\x1b[18;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 119 }).key,
      ).toBe("\x1b[19;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 120 }).key,
      ).toBe("\x1b[20;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 121 }).key,
      ).toBe("\x1b[21;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 122 }).key,
      ).toBe("\x1b[23;3~");
      expect(
        testEvaluateKeyboardEvent({ altKey: true, keyCode: 123 }).key,
      ).toBe("\x1b[24;3~");

      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 112 }).key,
      ).toBe("\x1b[1;5P");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 113 }).key,
      ).toBe("\x1b[1;5Q");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 114 }).key,
      ).toBe("\x1b[1;5R");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 115 }).key,
      ).toBe("\x1b[1;5S");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 116 }).key,
      ).toBe("\x1b[15;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 117 }).key,
      ).toBe("\x1b[17;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 118 }).key,
      ).toBe("\x1b[18;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 119 }).key,
      ).toBe("\x1b[19;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 120 }).key,
      ).toBe("\x1b[20;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 121 }).key,
      ).toBe("\x1b[21;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 122 }).key,
      ).toBe("\x1b[23;5~");
      expect(
        testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 123 }).key,
      ).toBe("\x1b[24;5~");
    });

    it("should return proper sequence for ctrl+alt+a", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          ctrlKey: true,
          keyCode: 65,
        }).key,
      ).toBe("\x1b\x01");
    });

    it("should return proper sequences for alt+0", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 48,
        }).key,
      ).toBe("\x1b0");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 48,
        }).key,
      ).toBe("\x1b)");
    });

    it("should return proper sequences for alt+1", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 49,
        }).key,
      ).toBe("\x1b1");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 49,
        }).key,
      ).toBe("\x1b!");
    });

    it("should return proper sequences for alt+2", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 50,
        }).key,
      ).toBe("\x1b2");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 50,
        }).key,
      ).toBe("\x1b@");
    });

    it("should return proper sequences for alt+3", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 51,
        }).key,
      ).toBe("\x1b3");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 51,
        }).key,
      ).toBe("\x1b#");
    });

    it("should return proper sequences for alt+4", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 52,
        }).key,
      ).toBe("\x1b4");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 52,
        }).key,
      ).toBe("\x1b$");
    });

    it("should return proper sequences for alt+5", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 53,
        }).key,
      ).toBe("\x1b5");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 53,
        }).key,
      ).toBe("\x1b%");
    });

    it("should return proper sequences for alt+6", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 54,
        }).key,
      ).toBe("\x1b6");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 54,
        }).key,
      ).toBe("\x1b^");
    });

    it("should return proper sequences for alt+7", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 55,
        }).key,
      ).toBe("\x1b7");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 55,
        }).key,
      ).toBe("\x1b&");
    });

    it("should return proper sequences for alt+8", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 56,
        }).key,
      ).toBe("\x1b8");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 56,
        }).key,
      ).toBe("\x1b*");
    });

    it("should return proper sequences for alt+9", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 57,
        }).key,
      ).toBe("\x1b9");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 57,
        }).key,
      ).toBe("\x1b(");
    });

    it("should return proper sequences for alt+;", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 186,
        }).key,
      ).toBe("\x1b;");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 186,
        }).key,
      ).toBe("\x1b:");
    });

    it("should return proper sequences for alt+=", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 187,
        }).key,
      ).toBe("\x1b=");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 187,
        }).key,
      ).toBe("\x1b+");
    });

    it("should return proper sequences for alt+,", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 188,
        }).key,
      ).toBe("\x1b,");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 188,
        }).key,
      ).toBe("\x1b<");
    });

    it("should return proper sequences for alt+-", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 189,
        }).key,
      ).toBe("\x1b-");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 189,
        }).key,
      ).toBe("\x1b_");
    });

    it("should return proper sequences for alt+.", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 190,
        }).key,
      ).toBe("\x1b.");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 190,
        }).key,
      ).toBe("\x1b>");
    });

    it("should return proper sequences for alt+/", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 191,
        }).key,
      ).toBe("\x1b/");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 191,
        }).key,
      ).toBe("\x1b?");
    });

    it("should return proper sequences for alt+~", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 192,
        }).key,
      ).toBe("\x1b`");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 192,
        }).key,
      ).toBe("\x1b~");
    });

    it("should return proper sequences for alt+[", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 219,
        }).key,
      ).toBe("\x1b[");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 219,
        }).key,
      ).toBe("\x1b{");
    });

    it("should return proper sequences for alt+\\", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 220,
        }).key,
      ).toBe("\x1b\\");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 220,
        }).key,
      ).toBe("\x1b|");
    });

    it("should return proper sequences for alt+]", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 221,
        }).key,
      ).toBe("\x1b]");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 221,
        }).key,
      ).toBe("\x1b}");
    });

    it("should return proper sequences for alt+'", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 222,
        }).key,
      ).toBe("\x1b'");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 222,
        }).key,
      ).toBe('\x1b"');
    });

    it("should handle mobile arrow events", () => {
      expect(
        testEvaluateKeyboardEvent({
          keyCode: 0,
          key: "UIKeyInputUpArrow",
        }).key,
      ).toBe("\x1b[A");
      expect(
        testEvaluateKeyboardEvent(
          { keyCode: 0, key: "UIKeyInputUpArrow" },
          { applicationCursorMode: true },
        ).key,
      ).toBe("\x1bOA");
      expect(
        testEvaluateKeyboardEvent({
          keyCode: 0,
          key: "UIKeyInputLeftArrow",
        }).key,
      ).toBe("\x1b[D");
      expect(
        testEvaluateKeyboardEvent(
          { keyCode: 0, key: "UIKeyInputLeftArrow" },
          { applicationCursorMode: true },
        ).key,
      ).toBe("\x1bOD");
      expect(
        testEvaluateKeyboardEvent({
          keyCode: 0,
          key: "UIKeyInputRightArrow",
        }).key,
      ).toBe("\x1b[C");
      expect(
        testEvaluateKeyboardEvent(
          { keyCode: 0, key: "UIKeyInputRightArrow" },
          { applicationCursorMode: true },
        ).key,
      ).toBe("\x1bOC");
      expect(
        testEvaluateKeyboardEvent({
          keyCode: 0,
          key: "UIKeyInputDownArrow",
        }).key,
      ).toBe("\x1b[B");
      expect(
        testEvaluateKeyboardEvent(
          { keyCode: 0, key: "UIKeyInputDownArrow" },
          { applicationCursorMode: true },
        ).key,
      ).toBe("\x1bOB");
    });

    it("should handle lowercase letters", () => {
      expect(testEvaluateKeyboardEvent({ keyCode: 65, key: "a" }).key).toBe(
        "a",
      );
      expect(testEvaluateKeyboardEvent({ keyCode: 189, key: "-" }).key).toBe(
        "-",
      );
    });

    it("should handle uppercase letters", () => {
      expect(
        testEvaluateKeyboardEvent({
          shiftKey: true,
          keyCode: 65,
          key: "A",
        }).key,
      ).toBe("A");
      expect(
        testEvaluateKeyboardEvent({
          shiftKey: true,
          keyCode: 49,
          key: "!",
        }).key,
      ).toBe("!");
    });

    it("should return proper sequences for alt+shift+letter combinations", () => {
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 65,
        }).key,
      ).toBe("\x1bA");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 72,
        }).key,
      ).toBe("\x1bH");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: true,
          keyCode: 90,
        }).key,
      ).toBe("\x1bZ");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 65,
        }).key,
      ).toBe("\x1ba");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 72,
        }).key,
      ).toBe("\x1bh");
      expect(
        testEvaluateKeyboardEvent({
          altKey: true,
          shiftKey: false,
          keyCode: 90,
        }).key,
      ).toBe("\x1bz");
    });

    it("should return proper sequence for ctrl+@", () => {
      expect(
        testEvaluateKeyboardEvent({
          ctrlKey: true,
          shiftKey: true,
          keyCode: 50,
          code: "Digit2",
          key: "@",
        }).key,
      ).toBe("\x00");
    });

    it("should return proper sequence for ctrl+^", () => {
      expect(
        testEvaluateKeyboardEvent({
          ctrlKey: true,
          shiftKey: true,
          keyCode: 54,
          code: "Digit6",
          key: "^",
        }).key,
      ).toBe("\x1e");
    });

    it("should return proper sequence for ctrl+_", () => {
      expect(
        testEvaluateKeyboardEvent({
          ctrlKey: true,
          shiftKey: true,
          keyCode: 189,
          code: "Minus",
          key: "_",
        }).key,
      ).toBe("\x1f");
    });
  });
});
