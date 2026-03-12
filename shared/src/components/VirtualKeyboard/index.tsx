import { Box, type SxProps, type Theme } from "@mui/material";
import {
  VIRTUAL_KEYBOARD_KEY_WIDTH,
  VIRTUAL_KEYBOARD_LABELS,
} from "./constants";
import { useVirtualKeyboard } from "./useVirtualKeyboard";

export type VirtualKeyboardProps = {
  sx?: SxProps<Theme>;
  /** called when user clicks a key on the virtual keyboard; sends terminal-ready data */
  onData: (data: string) => void;
};

/**
 * A mobile-friendly on-screen keyboard for terminal input.
 * It supports default/caps/fn/more view switching and uses flex rows.
 */
export function VirtualKeyboard({ sx, onData }: VirtualKeyboardProps) {
  const { rows, isTokenActive, onTokenPress } = useVirtualKeyboard({
    onData,
  });

  return (
    <Box
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          gap: 0.3,
          p: 0.5,
          borderRadius: 1,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? theme.palette.background.paper
              : theme.palette.grey[300],
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
          userSelect: "none",
          WebkitUserSelect: "none",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {rows.map((row, rowIndex) => (
        <Box
          // biome-ignore lint/suspicious/noArrayIndexKey: keyboard layout rows are static
          key={rowIndex}
          sx={{
            display: "flex",
            gap: 0.3,
            width: "100%",
          }}
        >
          {row.map((token, colIndex) => {
            const label = VIRTUAL_KEYBOARD_LABELS[token] ?? token;
            const grow = VIRTUAL_KEYBOARD_KEY_WIDTH[token] ?? 1;
            const isActive = isTokenActive(token);

            return (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: keyboard layout keys are static
                key={`${rowIndex}-${colIndex}`}
                role="button"
                tabIndex={0}
                onClick={() => onTokenPress(token)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTokenPress(token);
                  }
                }}
                sx={{
                  flex: `${grow} 1 0`,
                  minWidth: 0,
                  px: 1,
                  fontSize: "0.75rem",
                  lineHeight: "34px",
                  height: 34,
                  textAlign: "center",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: (theme) =>
                    isActive
                      ? theme.palette.primary.main
                      : theme.palette.divider,
                  bgcolor: (theme) =>
                    isActive
                      ? theme.palette.action.selected
                      : theme.palette.background.default,
                  color: (theme) => theme.palette.text.primary,
                  cursor: "pointer",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  touchAction: "manipulation",
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
