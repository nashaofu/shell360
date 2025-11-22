import { Controller, type UseFormReturn } from 'react-hook-form';
import {
  Icon,
  InputAdornment,
  MenuItem,
  TextField,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { AuthenticationMethod } from 'tauri-plugin-data';

import { useKeys } from '@/hooks/useKeys';

import { TextFieldPassword } from '../TextFieldPassword';

export type AuthenticationFormFields = {
  username?: string;
  authenticationMethod?: AuthenticationMethod;
  password?: string;
  keyId?: string;
};

export type AuthenticationFormProps = {
  formApi: UseFormReturn<AuthenticationFormFields>;
  onOpenAddKey: () => void;
};

export function AuthenticationForm({
  formApi,
  onOpenAddKey,
}: AuthenticationFormProps) {
  const { data: keys } = useKeys();
  const authenticationMethod = formApi.watch('authenticationMethod');

  return (
    <>
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
    </>
  );
}
