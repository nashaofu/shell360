import { KEYBOARD_KEY_WIDTH } from "./constants";
import styles from "./index.module.less";
import { useVirtualKeyboard } from "./useVirtualKeyboard";

export type VirtualKeyboardProps = {
  className?: string;
  onInput: (data: string) => void;
  applicationCursorKeysMode?: boolean;
};

/**
 * A mobile-friendly on-screen keyboard for terminal input.
 * It supports default/caps/fn/more view switching and uses flex rows.
 */
export function VirtualKeyboard({
  className,
  onInput,
  applicationCursorKeysMode,
}: VirtualKeyboardProps) {
  const { rows, checkKeyIsActive, onKeyClick } = useVirtualKeyboard({
    onInput,
    applicationCursorKeysMode,
  });

  return (
    <div className={[styles.root, className || ""].filter(Boolean).join(" ")}>
      {rows.map((row, rowIndex) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: keyboard layout rows are static
          key={rowIndex}
          className={styles.row}
        >
          {row.map((token, colIndex) => {
            const grow = KEYBOARD_KEY_WIDTH[token] ?? 1;
            const isActive = checkKeyIsActive(token);

            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: keyboard layout keys are static
                key={`${rowIndex}-${colIndex}-${token}`}
                type="button"
                onClick={() => onKeyClick(token)}
                className={
                  isActive ? `${styles.key} ${styles.keyActive}` : styles.key
                }
                style={{ flex: `${grow} 1 0` }}
              >
                {token}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
