import { Box, type SxProps, type Theme } from '@mui/material';
import {
  SSHLoading,
  XTerminal,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  VirtualKeyboard,
  type VirtualKeyboardModifiers,
} from 'shared';
import { useTerminal } from 'shared';
import { useState, useEffect, useRef } from 'react';

import openUrl from '@/utils/openUrl';
import { copy } from '@/utils/clipboard';

import Sftp from './Sftp';

type SSHTerminalProps = {
  item: TerminalAtom;
  sx: SxProps<Theme>;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

export default function SSHTerminal({
  item,
  sx,
  onClose,
  onOpenAddKey,
}: SSHTerminalProps) {
  const {
    loading,
    error,
    session,
    currentJumpHostChainItem,
    onReConnect,
    onReAuth,
    onRetry,
    terminal,
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
  } = useTerminal({ item, onClose, onCopy: copy });

  // keyboard is permanently on-screen
  const showKeyboard = true; // kept for clarity (always true)

  // modifier flags for virtual keyboard and physical key handling
  const [modifiers, setModifiers] = useState<VirtualKeyboardModifiers>({
    ctrl: false,
    alt: false,
    shift: false,
  });

  // use xterm's custom key event handler; the terminal prevents normal
  // keydown events from reaching the window when focused.  We attach the
  // handler once for the lifetime of the instance and use a ref to access the
  // latest modifier state.
  const modsRef = useRef(modifiers);
  useEffect(() => {
    modsRef.current = modifiers;
  }, [modifiers]);

  useEffect(() => {
    if (!terminal) return;

    const translate = (
      key: string,
      mods: { ctrl: boolean; alt: boolean; shift: boolean },
    ): string | undefined => {
      // printable character
      if (key.length === 1) {
        let ch = key;
        if (mods.ctrl) {
          ch = String.fromCharCode(ch.charCodeAt(0) & 0x1f);
        } else if (mods.shift) {
          ch = ch.toUpperCase();
        }
        if (mods.alt) {
          ch = '\x1b' + ch;
        }
        return ch;
      }

      // arrow keys with modifiers: CSI 1;<m><letter>
      const arrow: Record<string, string> = {
        ArrowUp: 'A',
        ArrowDown: 'B',
        ArrowRight: 'C',
        ArrowLeft: 'D',
      };
      if (arrow[key]) {
        const m =
          1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
        return `\x1b[1;${m}${arrow[key]}`;
      }

      // other special keys
      const specials: Record<string, string> = {
        Enter: '\r',
        Backspace: '\x7f',
        Tab: '\t',
        Escape: '\x1b',
        Home: '\x1b[H',
        End: '\x1b[F',
        PageUp: '\x1b[5~',
        PageDown: '\x1b[6~',
        Insert: '\x1b[2~',
        Delete: '\x1b[3~',
      };
      if (specials[key]) {
        let seq = specials[key];
        if (mods.alt && seq[0] !== '\x1b') {
          seq = '\x1b' + seq;
        }
        return seq;
      }

      return undefined;
    };

    const handler = (e: KeyboardEvent) => {
      if (e.type !== 'keydown') {
        return false;
      }
      const currentMods = modsRef.current;
      const effectiveMods = {
        ctrl: currentMods.ctrl || e.ctrlKey,
        alt: currentMods.alt || e.altKey,
        shift: currentMods.shift || e.shiftKey,
      };

      if (['Control', 'Shift', 'Alt'].includes(e.key)) {
        return true;
      }

      const data = translate(e.key, effectiveMods);
      if (data == null) {
        return true;
      }

      onTerminalData(data);
      return false;
    };

    terminal.attachCustomKeyEventHandler(handler);
  }, [terminal, onTerminalData]);

  return (
    <Box
      sx={[
        {
          position: 'relative',
          overflow: 'hidden',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 3,
          bottom: 54, // reserved space for always-visible virtual keyboard
          left: 0,
          pl: 3,
          overflow: 'hidden',
          pointerEvents: loading || error ? 'none' : 'unset',
          visibility: loading || error ? 'hidden' : 'visible',
          '.xterm': {
            width: '100%',
            height: '100%',
            '*::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            ':hover *::-webkit-scrollbar-thumb': {
              backgroundColor: '#7f7f7f',
            },
          },
        }}
        data-paste="true"
      >
        <XTerminal
          fontFamily={item.host.terminalSettings?.fontFamily}
          fontSize={item.host.terminalSettings?.fontSize}
          theme={
            TERMINAL_THEMES_MAP.get(item.host.terminalSettings?.theme)?.theme
          }
          onReady={onTerminalReady}
          onData={onTerminalData}
          onBinary={onTerminalBinaryData}
          onResize={onTerminalResize}
          onOpenUrl={openUrl}
        />
      </Box>
      {(!terminal || loading || error) && (
        <SSHLoading
          host={currentJumpHostChainItem?.host || item.host}
          loading={currentJumpHostChainItem?.loading}
          error={error}
          sx={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
            zIndex: 10,
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}
      {!loading && !error && session && <Sftp session={session} />}

      {/* always-visible keyboard */}
      {showKeyboard && (
        <VirtualKeyboard
          modifiers={modifiers}
          onInput={onTerminalData}
          onModifiersChange={setModifiers}
        />
      )}
    </Box>
  );
}
