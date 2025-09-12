import { ChangeEvent, KeyboardEvent, useCallback } from 'react';
import {
  Button,
  ButtonGroup,
  Icon,
  InputAdornment,
  TextField,
} from '@mui/material';

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
    (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const onKeyUp = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.code === 'Enter') {
        onOk();
        return;
      }

      if (e.code === 'Escape') {
        onCancel();
        return;
      }
    },
    [onCancel, onOk]
  );

  return (
    <TextField
      size="small"
      fullWidth
      value={value}
      onChange={onInputChange}
      onKeyUp={onKeyUp}
      variant="outlined"
      autoComplete="false"
      autoFocus={true}
      sx={{
        '.MuiInputBase-root': {
          paddingRight: 0,
        },
      }}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <ButtonGroup variant="text" color="inherit">
                <Button onClick={onCancel}>
                  <Icon className="icon-close" />
                </Button>
                <Button onClick={onOk}>
                  <Icon className="icon-check" />
                </Button>
              </ButtonGroup>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
