import {
  Icon,
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import {
  type ForwardedRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

type PasswordInputProps = Omit<
  TextFieldProps,
  'inputRef' | 'type' | 'InputProps'
>;

export const TextFieldPassword = forwardRef(function TextFieldPassword(
  props: PasswordInputProps,
  ref: ForwardedRef<HTMLInputElement>
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
        selectionDirection
      );
    });
  }, []);

  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
    ref,
    () => inputRef.current
  );

  return (
    <TextField
      {...props}
      inputRef={inputRef}
      type={isVisible ? 'text' : 'password'}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon className="icon-lock" />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={onVisibilityChange}>
              {isVisible ? (
                <Icon className="icon-visibility-off" />
              ) : (
                <Icon className="icon-visibility" />
              )}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
});
