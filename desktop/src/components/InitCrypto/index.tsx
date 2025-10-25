import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  DialogActions,
} from '@mui/material';
import { useRequest } from 'ahooks';
import { Controller, useForm } from 'react-hook-form';
import { changeCryptoEnable } from 'tauri-plugin-data';
import { Loading , TextFieldPassword } from 'shared';

import useMessage from '@/hooks/useMessage';

interface IniCryptoProps {
  open: boolean;
  onCancel: () => unknown;
  onOk: () => unknown;
}

export default function IniCrypto({ open, onCancel, onOk }: IniCryptoProps) {
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const { run: onInitCryptoPassword, loading: initCryptoPasswordLoading } =
    useRequest(
      async () => {
        const { password, confirmPassword } = formApi.getValues();
        await changeCryptoEnable({
          cryptoEnable: true,
          password,
          confirmPassword,
        });
      },
      {
        manual: true,
        onSuccess: () => {
          message.success({
            message: 'Initialization of crypto success',
          });
          onOk();
        },
        onError: () => {
          message.error({
            message: 'Initialization of crypto failed',
          });
        },
      }
    );

  const loading = initCryptoPasswordLoading;

  return (
    <Dialog open={open}>
      <DialogTitle>Initialize Crypto</DialogTitle>
      <Loading loading={loading} size={48}>
        <DialogContent>
          <DialogContentText>
            Set an encrypted password to protect application data
          </DialogContentText>
          <Box sx={{ mt: 6 }} component="form" noValidate autoComplete="off">
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

          <DialogActions sx={{ pt: 4 }}>
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={formApi.handleSubmit(onInitCryptoPassword)}
            >
              Submit
            </Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
