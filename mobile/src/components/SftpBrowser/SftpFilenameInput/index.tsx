import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { CheckIcon, CloseIcon } from "shared";
import styles from "./index.module.less";

type SftpFilenameInputProps = {
  value?: string;
  onChange: (val: string) => unknown;
  onCancel: () => unknown;
  onOk: () => unknown;
};

export default function SftpFilenameInput({
  value,
  onChange,
  onCancel,
  onOk,
}: SftpFilenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    const name = input.value;
    const dotIndex = name.lastIndexOf(".");
    const end = dotIndex > 0 ? dotIndex : name.length;
    input.setSelectionRange(0, end);
  }, []);

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const canConfirm = !!value?.trim();

  const onKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.code === "Enter") {
        if (value?.trim()) {
          onOk();
        }
        return;
      }

      if (e.code === "Escape") {
        onCancel();
        return;
      }
    },
    [onCancel, onOk, value],
  );

  return (
    <div className={styles.root}>
      <input
        ref={inputRef}
        className={styles.input}
        value={value || ""}
        onChange={onInputChange}
        onKeyUp={onKeyUp}
        spellCheck={false}
        autoComplete="off"
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirmButton}
          title="Confirm"
          disabled={!canConfirm}
          onClick={() => onOk()}
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          title="Cancel"
          onClick={() => onCancel()}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
