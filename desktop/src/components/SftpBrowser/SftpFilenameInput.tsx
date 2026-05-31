import { type ChangeEvent, type KeyboardEvent, useCallback } from "react";
import { CheckIcon, CloseIcon } from "shared";
import styles from "./SftpFilenameInput.module.less";

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
  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const onKeyUp = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.code === "Enter") {
        onOk();
        return;
      }

      if (e.code === "Escape") {
        onCancel();
        return;
      }
    },
    [onCancel, onOk],
  );

  return (
    <div className={styles.root}>
      <input
        className={styles.input}
        value={value || ""}
        onChange={onInputChange}
        onKeyUp={onKeyUp}
        autoComplete="off"
        autoFocus
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => onCancel()}
        >
          <CloseIcon />
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => onOk()}
        >
          <CheckIcon />
        </button>
      </div>
    </div>
  );
}
