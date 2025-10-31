import { Controller } from 'react-hook-form';
import {
  Box,
  Icon,
  InputAdornment,
  MenuItem,
  TextField,
  ListItemIcon,
  ListItemText,
  type SxProps,
  type Theme,
  Autocomplete,
  Chip,
} from '@mui/material';
import { AuthenticationMethod } from 'tauri-plugin-data';
import { useMemo } from 'react';

import { useKeys } from '@/hooks/useKeys';
import { useHosts } from '@/hooks/useHosts';

import { TextFieldPassword } from '../TextFieldPassword';

import type { EditHostFormApi } from './types';
import { TERMINAL_TYPES } from './terminalTypes';

type BasicFormProps = {
  formApi: EditHostFormApi;
  sx?: SxProps<Theme>;
  onOpenAddKey: () => void;
};

export default function BasicForm({
  formApi,
  sx,
  onOpenAddKey,
}: BasicFormProps) {
  const authenticationMethod = formApi.watch('authenticationMethod');
  const { data: keys } = useKeys();
  const { data: hosts } = useHosts();

  const tags = useMemo(() => {
    return hosts.reduce<string[]>((acc, cur) => {
      if (Array.isArray(cur.tags)) {
        acc.push(...cur.tags);
      }
      return acc;
    }, []);
  }, [hosts]);

  return (
    <Box sx={sx}>
      <Controller
        name="name"
        control={formApi.control}
        rules={{
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
            fullWidth
            label="Name"
            placeholder="Name"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />

      <Controller
        name="tags"
        control={formApi.control}
        rules={{
          maxLength: {
            value: 60,
            message: 'Please enter no more than 60 characters',
          },
        }}
        render={({ field, fieldState }) => {
          return (
            <Autocomplete
              {...field}
              sx={{
                mb: 3,
              }}
              onChange={(_, newValue) => field.onChange([...newValue])}
              multiple
              freeSolo
              fullWidth
              limitTags={3}
              options={tags}
              getOptionLabel={(option) => option}
              renderValue={(values, getItemProps) =>
                values.map((option, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return <Chip key={key} label={option} {...itemProps} />;
                })
              }
              renderInput={(props) => (
                <TextField
                  {...props}
                  label="Tags"
                  placeholder="Tags"
                  error={fieldState.invalid}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          );
        }}
      />

      <Controller
        name="hostname"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter hostname',
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
            label="Hostname"
            placeholder="Hostname"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon className="icon-host" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />

      <Controller
        name="port"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter port',
          },
          pattern: {
            value: /^\d+$/,
            message: 'Please enter the number',
          },
          min: {
            value: 1,
            message: 'The port cannot be less than 1',
          },
          max: {
            value: 65535,
            message: 'The port cannot be greater than 1',
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
            label="Port"
            placeholder="Port"
            type="number"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon className="icon-number" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />

      <Controller
        name="username"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter username',
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
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            required
            fullWidth
            label="Username"
            placeholder="Username"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon className="icon-user" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />

      <Controller
        name="authenticationMethod"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please select authentication method',
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
            label="Authentication method"
            placeholder="Authentication method"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            <MenuItem value={AuthenticationMethod.Password}>Password</MenuItem>
            <MenuItem value={AuthenticationMethod.PublicKey}>
              PublicKey
            </MenuItem>
            <MenuItem value={AuthenticationMethod.Certificate}>
              Certificate
            </MenuItem>
          </TextField>
        )}
      />

      {authenticationMethod === AuthenticationMethod.Password && (
        <Controller
          name="password"
          control={formApi.control}
          rules={{
            maxLength: {
              value: 100,
              message: 'Please enter no more than 100 characters',
            },
          }}
          render={({ field, fieldState }) => (
            <TextFieldPassword
              {...field}
              sx={{
                mb: 3,
              }}
              fullWidth
              label="Password"
              placeholder="Password"
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            />
          )}
        />
      )}

      {(authenticationMethod === AuthenticationMethod.PublicKey ||
        authenticationMethod === AuthenticationMethod.Certificate) && (
        <Controller
          name="keyId"
          control={formApi.control}
          rules={{
            required: {
              value: true,
              message: 'Please select key',
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
              label="Key"
              placeholder="Key"
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            >
              <MenuItem value="" onClick={onOpenAddKey}>
                <ListItemIcon>
                  <Icon className="icon-add" />
                </ListItemIcon>
                <ListItemText>Add key</ListItemText>
              </MenuItem>
              {keys.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      )}

      <Controller
        name="startupCommand"
        control={formApi.control}
        rules={{
          maxLength: {
            value: 500,
            message: 'Please enter no more than 500 characters',
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            fullWidth
            label="Startup Command"
            placeholder="Command to execute after connection (optional)"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon className="icon-code" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />

      <Controller
        name="terminalType"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please select terminal type',
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
            label="Terminal type"
            placeholder="Terminal type"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            {TERMINAL_TYPES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        name="envs"
        control={formApi.control}
        rules={{
          validate: (value) => {
            if (!value) {
              return true;
            }
            const envs = value.split(',');
            for (const env of envs) {
              const [key, value] = env.split('=');
              if (!key || !value) {
                return 'Invalid environment variable format';
              }
            }
            return true;
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            fullWidth
            label="Environment variables"
            placeholder="e.g. KEY1=VALUE1,KEY2=VALUE2"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon className="icon-variable" />
                  </InputAdornment>
                ),
              },
            }}
          ></TextField>
        )}
      />
    </Box>
  );
}
