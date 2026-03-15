import { Box, type SxProps, type Theme } from "@mui/material";
import { KEYBOARD_KEY_WIDTH } from "./constants";
import { useVirtualKeyboard } from "./useVirtualKeyboard";

export type VirtualKeyboardProps = {
  sx?: SxProps<Theme>;
  onInput: (data: string) => void;
  applicationCursorKeysMode?: boolean;
};

/**
 * A mobile-friendly on-screen keyboard for terminal input.
 * It supports default/caps/fn/more view switching and uses flex rows.
 */
export function VirtualKeyboard({
  sx,
  onInput,
  applicationCursorKeysMode,
}: VirtualKeyboardProps) {
  const { rows, checkKeyIsActive, onKeyClick } = useVirtualKeyboard({
    onInput,
    applicationCursorKeysMode,
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
            const grow = KEYBOARD_KEY_WIDTH[token] ?? 1;
            const isActive = checkKeyIsActive(token);

            return (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: keyboard layout keys are static
                key={`${rowIndex}-${colIndex}-${token}`}
                onClick={() => onKeyClick(token)}
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
                  "&:active": {
                    bgcolor: (theme) => theme.palette.action.hover,
                  },
                }}
              >
                {token}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
