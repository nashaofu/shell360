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
  /** called when user clicks a key on the virtual keyboard; sends KeyboardEvent.key value */
  onInput: (key: string) => void;
};

/**
 * A small on-screen keyboard that can send a handful of useful keys to the
 * terminal.  Only the special keys are implemented here; normal characters are
 * usually typed with the real keyboard.  On mobile platforms the normal
 * OS keyboard does not work well inside the xterm canvas, so this component
 * gives the user a way to send control/arrow keys, escape, tab, etc.
 */
export function VirtualKeyboard({
  modifiers = { ctrl: false, alt: false, shift: false },
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
        <Button size="small" onClick={() => onInput('Escape')}>
          Esc
        </Button>
        <Button size="small" onClick={() => onInput('Tab')}>
          Tab
        </Button>
        <Button size="small" onClick={() => onInput('Enter')}>
          Enter
        </Button>
        <Button size="small" onClick={() => onInput('Backspace')}>
          Backspace
        </Button>
        <Button size="small" onClick={() => onInput('Insert')}>
          Insert
        </Button>
        <Button size="small" onClick={() => onInput('Delete')}>
          Delete
        </Button>
        <Button size="small" onClick={() => onInput('Home')}>
          Home
        </Button>
        <Button size="small" onClick={() => onInput('End')}>
          End
        </Button>
        <Button size="small" onClick={() => onInput('PageUp')}>
          PageUp
        </Button>
        <Button size="small" onClick={() => onInput('PageDown')}>
          PageDown
        </Button>
        <Button size="small" onClick={() => onInput('ArrowUp')}>
          ↑
        </Button>
        <Button size="small" onClick={() => onInput('ArrowDown')}>
          ↓
        </Button>
        <Button size="small" onClick={() => onInput('ArrowRight')}>
          →
        </Button>
        <Button size="small" onClick={() => onInput('ArrowLeft')}>
          ←
        </Button>
      </Box>
    </Box>
  );
}

// maintain previous default export ease-of-use
export default VirtualKeyboard;
