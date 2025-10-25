import { Controller, UseFormReturn } from 'react-hook-form';
import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Divider,
  SxProps,
  Theme,
} from '@mui/material';
import { Host } from 'tauri-plugin-data';

import JumpHostIdsSelect from './JumpHostIdsSelect';

type JumpHostsFormProps = {
  formApi: UseFormReturn<Omit<Host, 'id'>>;
  hostId?: string;
  sx?: SxProps<Theme>;
};

export default function JumpHostsForm({
  formApi,
  hostId,
  sx,
}: JumpHostsFormProps) {
  const jumpHostEnabled = formApi.watch('jumpHostEnabled');

  return (
    <Box sx={sx}>
      <Divider sx={{ mb: 2 }}>
        <Typography variant="subtitle1">Jump Hosts</Typography>
      </Divider>
      <Controller
        name="jumpHostEnabled"
        control={formApi.control}
        render={({ field }) => {
          return (
            <ToggleButtonGroup
              {...field}
              onChange={(_, value) => field.onChange(!!value)}
              exclusive
              size="small"
              fullWidth
            >
              <ToggleButton value={false}>Disabled</ToggleButton>
              <ToggleButton value={true}>Enabled</ToggleButton>
            </ToggleButtonGroup>
          );
        }}
      />

      {jumpHostEnabled && (
        <Controller
          name="jumpHostIds"
          control={formApi.control}
          rules={{
            validate: (value) => {
              if (value.length === 0) {
                return 'Please select at least one jump host';
              }
              return true;
            },
          }}
          render={({ field, fieldState }) => (
            <JumpHostIdsSelect
              sx={{ mt: 3 }}
              value={field.value || []}
              onChange={field.onChange}
              hostId={hostId}
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            />
          )}
        />
      )}
    </Box>
  );
}
