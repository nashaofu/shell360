import { Controller, UseFormReturn } from 'react-hook-form';
import { useState } from 'react';
import {
  Box,
  Icon,
  InputAdornment,
  MenuItem,
  TextField,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { TERMINAL_THEMES, useKeys } from 'shared';
import { Host, AuthenticationMethod } from 'tauri-plugin-data';

import AddKey from '@/components/AddKey';

import TextFieldPassword from '../TextFieldPassword';

type EditHostFormProps = {
  formApi: UseFormReturn<Omit<Host, 'id'>>;
};

export default function EditHostForm({ formApi }: EditHostFormProps) {
  const authenticationMethod = formApi.watch('authenticationMethod');
  const { data: keys } = useKeys();
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);

  return (
    <>
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon className="icon-label" />
                  </InputAdornment>
                ),
              }}
            />
          )}
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
              value: 3,
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
              message: 'Please select auth method',
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
              label="Auth method"
              placeholder="Auth method"
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            >
              <MenuItem value={AuthenticationMethod.Password}>
                Password
              </MenuItem>
              <MenuItem value={AuthenticationMethod.PublicKey}>
                PublicKey
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

        {authenticationMethod === AuthenticationMethod.PublicKey && (
          <Controller
            name="keyId"
            control={formApi.control}
            rules={{
              required: {
                value: true,
                message: 'Please select public key',
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
                <MenuItem value="" onClick={() => setIsOpenAddKey(true)}>
                  <ListItemIcon>
                    <Icon className="icon-add" />
                  </ListItemIcon>
                  <ListItemText>Add public key</ListItemText>
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
              sx={{
                mb: 3,
              }}
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

      <AddKey
        open={isOpenAddKey}
        onOk={() => setIsOpenAddKey(false)}
        onCancel={() => setIsOpenAddKey(false)}
      />
    </>
  );
}
