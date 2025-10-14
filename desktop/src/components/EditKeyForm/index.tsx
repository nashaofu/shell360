import { Controller, UseFormReturn } from 'react-hook-form';
import { useCallback } from 'react';
import {
  Box,
  Icon,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import { Key } from 'tauri-plugin-data';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';

import TextFieldPassword from '../TextFieldPassword';

type EditKeyFormProps = {
  formApi: UseFormReturn<Omit<Key, 'id'>>;
};

export default function EditKeyForm({ formApi }: EditKeyFormProps) {
  const importPrivatekey = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: false,
    });

    if (!file) {
      return;
    }

    const text = await readTextFile(file);

    const filename = file.split(/[\\/]/).pop() || '';
    formApi.setValue('name', filename);
    formApi.setValue('privateKey', text);
  }, [formApi]);

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
        name="privateKey"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: 'Please enter private key',
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
            label="Private key"
            placeholder="Private key"
            multiline
            maxRows={8}
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={importPrivatekey}>
                    <Icon className="icon-file-upload" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}
      />
      <Controller
        name="publicKey"
        control={formApi.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            sx={{
              mb: 3,
            }}
            required
            fullWidth
            label="Public key"
            placeholder="Public key"
            multiline
            maxRows={8}
            error={fieldState.invalid}
            helperText={fieldState.error?.message}
          />
        )}
      />
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
