import { Box, Button } from '@mui/material';
import { useCallback } from 'react';

export interface VirtualKeyboardModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export type VirtualKeyboardProps = {
  /** controlled modifier state */
  modifiers?: VirtualKeyboardModifiers;
  /** called whenever ctrl/alt/shift state changes */
  onModifiersChange?: (modifiers: VirtualKeyboardModifiers) => void;
  /** called when user clicks a key on the virtual keyboard; sends the key's value (e.g. "\x1b" for Esc) */
  onInput: (data: string) => void;
};

/**
 * A small on-screen keyboard that can send a handful of useful keys to the
 * terminal.  Only the special keys are implemented here; normal characters are
 * usually typed with the real keyboard.  On mobile platforms the normal
 * OS keyboard does not work well inside the xterm canvas, so this component
 * gives the user a way to send control/arrow keys, escape, tab, etc.
 */
export function VirtualKeyboard({
  modifiers,
  onModifiersChange,
  onInput,
}: VirtualKeyboardProps) {
  const toggle = useCallback(
    (key: keyof VirtualKeyboardModifiers) => {
      const updated = { ...modifiers, [key]: !modifiers[key] };
      onModifiersChange?.(updated);
    },
    [modifiers, onModifiersChange],
  );

  const send = useCallback(
    (value: string) => {
      let data = value;

      // apply modifiers; ctrl converts letters to control codes,
      // alt prefixes with escape and shift simply uppercases the character
      if (modifiers.ctrl && value.length === 1) {
        const code = value.charCodeAt(0);
        // ctrl-A .. ctrl-_  -> 0x01 .. 0x1f
        if (code >= 0x40 && code <= 0x5f) {
          data = String.fromCharCode(code & 0x1f);
        }
      }
      if (modifiers.alt) {
        data = '\x1b' + data;
      }
      if (modifiers.shift && value.length === 1) {
        data = value.toUpperCase();
      }
      onInput(data);
    },
    [onInput, modifiers],
  );

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: 'rgba(0,0,0,0.75)',
        py: 0.5,
        zIndex: 20,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Button
          size="small"
          variant={modifiers.ctrl ? 'contained' : 'outlined'}
          onClick={() => toggle('ctrl')}
        >
          Ctrl
        </Button>
        <Button
          size="small"
          variant={modifiers.alt ? 'contained' : 'outlined'}
          onClick={() => toggle('alt')}
        >
          Alt
        </Button>
        <Button
          size="small"
          variant={modifiers.shift ? 'contained' : 'outlined'}
          onClick={() => toggle('shift')}
        >
          Shift
        </Button>
        <Button size="small" onClick={() => send('\x1b')}>
          Esc
        </Button>
        <Button size="small" onClick={() => send('\t')}>
          Tab
        </Button>
        <Button size="small" onClick={() => send('\r')}>
          Enter
        </Button>
        <Button size="small" onClick={() => send('\x7f')}>
          Backspace
        </Button>
        <Button size="small" onClick={() => send('\x1b[A')}>
          ↑
        </Button>
        <Button size="small" onClick={() => send('\x1b[B')}>
          ↓
        </Button>
        <Button size="small" onClick={() => send('\x1b[C')}>
          →
        </Button>
        <Button size="small" onClick={() => send('\x1b[D')}>
          ←
        </Button>
      </Box>
    </Box>
  );
}

// maintain previous default export ease-of-use
export default VirtualKeyboard;
