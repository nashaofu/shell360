import { Controller, type UseFormReturn } from 'react-hook-form';
import { Box, MenuItem, TextField } from '@mui/material';
import { PortForwardingType } from 'tauri-plugin-data';

import { useHosts } from '@/hooks/useHosts';

export type PortForwardingFormFields = {
  name: string;
  portForwardingType: PortForwardingType;
  hostId: string;
  localAddress: string;
  localPort: number | '';
  remoteAddress?: string;
  remotePort?: number | '';
};

export type PortForwardingFormProps = {
  formApi: UseFormReturn<PortForwardingFormFields>;
};

const PORT_FORWARDING_TYPES = [
  {
    label: 'Local forwarding',
    value: PortForwardingType.Local,
  },
  {
    label: 'Remote forwarding',
    value: PortForwardingType.Remote,
  },
  {
    label: 'Dynamic forwarding',
    value: PortForwardingType.Dynamic,
  },
];

export function PortForwardingForm({ formApi }: PortForwardingFormProps) {
  const portForwardingType = formApi.watch('portForwardingType');
  const { data: hosts } = useHosts();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
      }}
      component="form"
      noValidate
      autoComplete="off"
    >
      <Controller
        name="name"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter name',
          },
          minLength: {
            value: 1,
            message: 'Please enter at least 1 characters',
          },
          maxLength: {
            value: 60,
            message: 'Please enter no more than 60 characters',
          },
        }}
        defaultValue=""
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            required
            fullWidth
            label="name"
            placeholder="name"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="portForwardingType"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please select port forwarding type',
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            select
            required
            fullWidth
            label="Port forwarding type"
            placeholder="Port forwarding type"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            {PORT_FORWARDING_TYPES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        name="hostId"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please select host',
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            select
            fullWidth
            required
            label="Host"
            placeholder="Host"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            {hosts.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name || `${item.hostname}:${item.port}`}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        name="localAddress"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter local address',
          },
          minLength: {
            value: 3,
            message: 'Please enter at least 3 characters',
          },
          maxLength: {
            value: 60,
            message: 'Please enter no more than 60 characters',
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
            label="Local address"
            placeholder="Local address"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />

      <Controller
        name="localPort"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter local port',
          },
          pattern: {
            value: /^\d+$/,
            message: 'Please enter the number',
          },
          min: {
            value: 1,
            message: 'The local port cannot be less than 1',
          },
          max: {
            value: 65535,
            message: 'The local port cannot be greater than 1',
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
            label="Local port"
            placeholder="Local port"
            type="number"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />

      {portForwardingType !== PortForwardingType.Dynamic && (
        <>
          <Controller
            name="remoteAddress"
            control={formApi.control}
            rules={{
              required: {
                value: true,
                message: 'Please enter remote address',
              },
              minLength: {
                value: 3,
                message: 'Please enter at least 3 characters',
              },
              maxLength: {
                value: 60,
                message: 'Please enter no more than 60 characters',
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
                label="Remote address"
                placeholder="Remote address"
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="remotePort"
            control={formApi.control}
            rules={{
              required: {
                value: true,
                message: 'Please enter remote port',
              },
              pattern: {
                value: /^\d+$/,
                message: 'Please enter the number',
              },
              min: {
                value: 1,
                message: 'The remote port cannot be less than 1',
              },
              max: {
                value: 65535,
                message: 'The remote port cannot be greater than 1',
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
                label="Remote port"
                placeholder="Remote port"
                type="number"
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </>
      )}
    </Box>
  );
}
