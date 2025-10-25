import { Controller, type UseFormReturn } from 'react-hook-form';
import { Box, MenuItem, TextField } from '@mui/material';

import { TextFieldPassword } from '../TextFieldPassword';

enum Algorithm {
  Ed25519 = 'Ed25519',
  Rsa = 'Rsa',
  Ecdsa = 'Ecdsa',
}

const ALGORITHM_MENUS = [
  {
    label: 'ed25519',
    value: Algorithm.Ed25519,
  },
  {
    label: 'rsa',
    value: Algorithm.Rsa,
  },
  {
    label: 'ecdsa',
    value: Algorithm.Ecdsa,
  },
];

const RSA_BIT_SIZE = [
  {
    label: '2048',
    value: 2048,
  },
  {
    label: '4096',
    value: 4096,
  },
];

const ECDSA_CURVE = [
  {
    label: 'NIST P-256',
    value: 'NistP256',
  },
  {
    label: 'NIST P-384',
    value: 'NistP384',
  },
  {
    label: 'NIST P-521',
    value: 'NistP521',
  },
];

export type GenerateKeyFormFields = {
  name: string;
  algorithm: Algorithm | '';
  bitSize?: 2048 | 4096 | '';
  curve?: 'NistP256' | 'NistP384' | 'NistP521' | '';
  passphrase?: string;
};

export type GenerateKeyFormProps = {
  formApi: UseFormReturn<GenerateKeyFormFields>;
};

export function GenerateKeyForm({ formApi }: GenerateKeyFormProps) {
  const algorithm = formApi.watch('algorithm');

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
            label="Name"
            placeholder="Name"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="algorithm"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please select algorithm',
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
            label="Algorithm"
            placeholder="Algorithm"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          >
            {ALGORITHM_MENUS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      {algorithm === Algorithm.Rsa && (
        <Controller
          name="bitSize"
          control={formApi.control}
          rules={{
            required: {
              value: true,
              message: 'Please select bit size',
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
              label="Bit size"
              placeholder="Bit size"
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            >
              {RSA_BIT_SIZE.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      )}
      {algorithm === Algorithm.Ecdsa && (
        <Controller
          name="curve"
          control={formApi.control}
          rules={{
            required: {
              value: true,
              message: 'Please select curve',
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
              label="Curve"
              placeholder="Curve"
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            >
              {ECDSA_CURVE.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      )}
      <Controller
        name="passphrase"
        control={formApi.control}
        render={({ field, fieldState }) => (
          <TextFieldPassword
            {...field}
            fullWidth
            label="Passphrase"
            placeholder="Passphrase"
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
    </Box>
  );
}
