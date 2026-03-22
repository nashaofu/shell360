import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useRequest } from "ahooks";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Loading, TextFieldPassword } from "shared";

import useMessage from "@/hooks/useMessage";

interface RemoteSyncLoginProps {
  open: boolean;
  onCancel: () => unknown;
  onOk: (values: {
    loginId: string;
    credential: string;
  }) => Promise<unknown> | unknown;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

export default function RemoteSyncLogin({
  open,
  onCancel,
  onOk,
}: RemoteSyncLoginProps) {
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      loginId: "",
      credential: "",
    },
  });

  const { run: onSubmit, loading } = useRequest(
    async () => {
      const values = formApi.getValues();
      await onOk({
        loginId: values.loginId.trim(),
        credential: values.credential,
      });
    },
    {
      manual: true,
      onSuccess: () => {
        message.success({
          message: "Remote sync login successful",
        });
      },
      onError: (error) => {
        message.error({
          message: `Remote sync login failed: ${getErrorMessage(error)}`,
        });
      },
    },
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    formApi.reset();
  }, [formApi, open]);

  return (
    <Dialog open={open} onClose={() => onCancel()}>
      <DialogTitle>Remote Sync Login</DialogTitle>
      <Loading loading={loading} size={32}>
        <DialogContent>
          <DialogContentText>
            Login to the official sync service and store the access token
            locally.
          </DialogContentText>
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ mt: 4 }}>
              <Controller
                name="loginId"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: "Please enter login ID",
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    required
                    fullWidth
                    label="Login ID"
                    placeholder="user@example.com"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  ></TextField>
                )}
              />
            </Box>
            <Box sx={{ mt: 4 }}>
              <Controller
                name="credential"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: "Please enter credential",
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextFieldPassword
                    {...field}
                    required
                    fullWidth
                    label="Credential"
                    placeholder="Credential"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  ></TextFieldPassword>
                )}
              />
            </Box>
          </Box>
          <DialogActions sx={{ pt: 4 }}>
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={formApi.handleSubmit(onSubmit)}
            >
              Login
            </Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
