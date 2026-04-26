import { IconButton, Text, TextField } from "@radix-ui/themes";
import {
  type ChangeEvent,
  type FocusEvent,
  type ForwardedRef,
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useState,
} from "react";
import { LockIcon, VisibilityIcon, VisibilityOffIcon } from "../Icon";
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

  const onVisibilityChange = useCallback(() => {
    setIsVisible((val) => !val);
  }, []);

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

      <TextField.Root
        ref={ref}
        type={isVisible ? "text" : "password"}
        name={name}
        value={value || ""}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={onChange}
        onBlur={onBlur}
        onKeyUp={onKeyUp}
        color={error ? "red" : undefined}
      >
        <TextField.Slot>
          <LockIcon aria-hidden="true" />
        </TextField.Slot>
        <TextField.Slot side="right">
          <IconButton
            type="button"
            variant="ghost"
            color="gray"
            size="1"
            onClick={onVisibilityChange}
            aria-label={isVisible ? "Hide password" : "Show password"}
          >
            {isVisible ? (
              <VisibilityOffIcon aria-hidden="true" />
            ) : (
              <VisibilityIcon aria-hidden="true" />
            )}
          </IconButton>
        </TextField.Slot>
      </TextField.Root>

      {helperText && (
        <Text size="1" color={error ? "red" : "gray"}>
          {helperText}
        </Text>
      )}
    </div>
  );
});
