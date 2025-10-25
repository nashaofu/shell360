import { Controller, UseFormReturn } from 'react-hook-form';
import {
  Box,
  MenuItem,
  TextField,
  Typography,
  Divider,
  SxProps,
  Theme,
} from '@mui/material';
import { TERMINAL_THEMES } from 'shared';
import { Host } from 'tauri-plugin-data';

type TerminalSettingsFormProps = {
  formApi: UseFormReturn<Omit<Host, 'id'>>;
  sx?: SxProps<Theme>;
};

export default function TerminalSettingsForm({
  formApi,
  sx,
}: TerminalSettingsFormProps) {
  return (
    <Box sx={sx}>
      <Divider sx={{ mb: 2 }}>
        <Typography variant="subtitle1">Terminal Settings</Typography>
      </Divider>

      <Controller
        name="terminalSettings.fontFamily"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter font family',
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            required
            fullWidth
            label="Font family"
            placeholder="Font family"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />

      <Controller
        name="terminalSettings.fontSize"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter font size',
          },
          pattern: {
            value: /^\d+$/,
            message: 'Please enter the number',
          },
          min: {
            value: 10,
            message: 'The font size cannot be less than 10',
          },
          max: {
            value: 48,
            message: 'The font size cannot be greater than 48',
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            required
            fullWidth
            label="Font size"
            placeholder="Font size"
            type="number"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />

      <Controller
        name="terminalSettings.theme"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please select theme',
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            select
            fullWidth
            required
            label="Theme"
            placeholder="Theme"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            {TERMINAL_THEMES.map((item) => (
              <MenuItem key={item.name} value={item.name}>
                {item.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </Box>
  );
}
