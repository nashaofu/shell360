import {
  type ChangeEvent,
  type FocusEvent,
  type ForwardedRef,
  type KeyboardEvent,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Text } from "@radix-ui/themes";
import styles from "./index.module.less";

type PasswordInputProps = {
  value?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  error?: boolean;
  helperText?: string;
  className?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyUp?: (event: KeyboardEvent<HTMLInputElement>) => void;
  sx?: unknown;
};

export const TextFieldPassword = forwardRef(function TextFieldPassword(
  {
    value,
    name,
    label,
    placeholder,
    required,
    disabled,
    fullWidth,
    error,
    helperText,
    className,
    onChange,
    onBlur,
    onKeyUp,
  }: PasswordInputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onVisibilityChange = useCallback(() => {
    const selectionStart = inputRef.current?.selectionStart ?? null;
    const selectionEnd = inputRef.current?.selectionEnd ?? null;
    const selectionDirection =
      inputRef.current?.selectionDirection ?? undefined;
    setIsVisible((val) => !val);

    requestAnimationFrame(() => {
      inputRef?.current?.setSelectionRange(
        selectionStart,
        selectionEnd,
        selectionDirection,
      );
    });
  }, []);

  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
    ref,
    () => inputRef.current,
  );

  const rootClassName = [
    styles.root,
    fullWidth ? styles.fullWidth : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {label && (
        <Text as="label" size="2" weight="medium" className={styles.label}>
          {label}
        </Text>
      )}

      <div
        className={
          error
            ? `${styles.inputWrap} ${styles.inputWrapError}`
            : styles.inputWrap
        }
      >
        <span className={`${styles.icon} icon-lock`} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          name={name}
          value={value || ""}
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
          onKeyUp={onKeyUp}
        />
        <button
          type="button"
          className={styles.visibilityButton}
          onClick={onVisibilityChange}
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          <span
            className={isVisible ? "icon-visibility-off" : "icon-visibility"}
            aria-hidden="true"
          />
        </button>
      </div>

      {helperText && (
        <Text
          size="1"
          className={
            error ? `${styles.helper} ${styles.helperError}` : styles.helper
          }
        >
          {helperText}
        </Text>
      )}
    </div>
  );
});
