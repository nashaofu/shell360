import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useRequest } from 'ahooks';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { changeCryptoPassword } from 'tauri-plugin-data';

import useMessage from '@/hooks/useMessage';

import TextFieldPassword from '../TextFieldPassword';
import Loading from '../Loading';

interface ChangeCryptoPasswordProps {
  open: boolean;
  onCancel: () => unknown;
  onOk: () => unknown;
}

export default function ChangeCryptoPassword({
  open,
  onCancel,
  onOk,
}: ChangeCryptoPasswordProps) {
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      oldPassword: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { run: onSubmit, loading } = useRequest(
    async () => {
      const { oldPassword, password, confirmPassword } = formApi.getValues();
      await changeCryptoPassword({ oldPassword, password, confirmPassword });
    },
    {
      manual: true,
      onSuccess: () => {
        message.success({
          message: 'Change crypto password success',
        });
        onOk();
      },
      onError: () => {
        message.error({
          message: 'Change crypto password failed',
        });
      },
    }
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    formApi.reset();
  }, [open, formApi]);

  return (
    <Dialog
      open={open}
      sx={{
        '.MuiDialog-container': {
          paddingTop: 'env(safe-area-inset-top)',
        },
      }}
    >
      <DialogTitle>Change Crypto Password</DialogTitle>
      <Loading loading={loading} size={32}>
        <DialogContent>
          <DialogContentText>
            Please enter the encryption password to reset the key
          </DialogContentText>
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ mt: 4 }}>
              <Controller
                name="oldPassword"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: 'Please enter old password',
                  },
                  minLength: {
                    value: 8,
                    message: 'Please enter at least 8 characters',
                  },
                  maxLength: {
                    value: 128,
                    message: 'Please enter no more than 128 characters',
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextFieldPassword
                    {...field}
                    required
                    fullWidth
                    label="Old Password"
                    placeholder="Old Password"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  ></TextFieldPassword>
                )}
              />
            </Box>
            <Box sx={{ mt: 4 }}>
              <Controller
                name="password"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: 'Please enter password',
                  },
                  minLength: {
                    value: 8,
                    message: 'Please enter at least 8 characters',
                  },
                  maxLength: {
                    value: 128,
                    message: 'Please enter no more than 128 characters',
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextFieldPassword
                    {...field}
                    required
                    fullWidth
                    label="Password"
                    placeholder="Password"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  ></TextFieldPassword>
                )}
              />
            </Box>
            <Box sx={{ mt: 4 }}>
              <Controller
                name="confirmPassword"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: 'Please enter confirm password',
                  },
                  minLength: {
                    value: 8,
                    message: 'Please enter at least 8 characters',
                  },
                  maxLength: {
                    value: 128,
                    message: 'Please enter no more than 128 characters',
                  },
                  validate: (value, formValues) => {
                    if (value !== formValues.password) {
                      return 'The password confirmation does not match the password';
                    }
                    return true;
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextFieldPassword
                    {...field}
                    required
                    fullWidth
                    label="Confirm Password"
                    placeholder="Confirm password"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  ></TextFieldPassword>
                )}
              ></Controller>
            </Box>
          </Box>
          <DialogActions sx={{ pt: 4 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button onClick={formApi.handleSubmit(onSubmit)}>Submit</Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
