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

import selectFile from '@/utils/selectFile';

import TextFieldPassword from '../TextFieldPassword';

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    // 创建一个FileReader对象
    const reader = new FileReader();

    // 监听load事件，读取完成后触发
    reader.addEventListener('load', (event) =>
      resolve(event.target?.result as string)
    );

    // 监听error事件，读取出错时触发
    reader.addEventListener('abort', (event) => reject(event.target?.error));

    reader.readAsText(file);
  });
}

type EditKeyFormProps = {
  formApi: UseFormReturn<Omit<Key, 'id'>>;
};

export default function EditKeyForm({ formApi }: EditKeyFormProps) {
  const importPrivatekey = useCallback(async () => {
    const [file] = await selectFile();
    if (!file) {
      return;
    }

    const text = await readFileAsText(file);

    formApi.setValue('name', file.name);
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
