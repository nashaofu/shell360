import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useRequest } from "ahooks";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Loading, TextFieldPassword, useSync } from "shared";

import useMessage from "@/hooks/useMessage";

interface UnlockSyncSecretProps {
  open: boolean;
  onCancel: () => unknown;
  onOk: () => unknown;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

export default function UnlockSyncSecret({
  open,
  onCancel,
  onOk,
}: UnlockSyncSecretProps) {
  const { unlockSecret } = useSync();
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      password: "",
    },
  });

  const { run: onSubmit, loading } = useRequest(
    async () => {
      const { password } = formApi.getValues();
      await unlockSecret({ password });
    },
    {
      manual: true,
      onSuccess: () => {
        message.success({
          message: "Unlock sync secret successful",
        });
        onOk();
      },
      onError: (error) => {
        message.error({
          message: `Unlock sync secret failed: ${getErrorMessage(error)}`,
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
      <DialogTitle>Unlock Sync Secret</DialogTitle>
      <Loading loading={loading} size={32}>
        <DialogContent>
          <DialogContentText>
            Enter the sync password to unlock snapshot export and restore.
          </DialogContentText>
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ mt: 4 }}>
              <Controller
                name="password"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: "Please enter password",
                  },
                  minLength: {
                    value: 8,
                    message: "Please enter at least 8 characters",
                  },
                  maxLength: {
                    value: 128,
                    message: "Please enter no more than 128 characters",
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
          </Box>
          <DialogActions sx={{ pt: 4 }}>
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={formApi.handleSubmit(onSubmit)}
            >
              Unlock
            </Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
