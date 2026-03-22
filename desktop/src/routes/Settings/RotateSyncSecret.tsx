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

interface RotateSyncSecretProps {
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

export default function RotateSyncSecret({
  open,
  onCancel,
  onOk,
}: RotateSyncSecretProps) {
  const { rotateSecret } = useSync();
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { run: onSubmit, loading } = useRequest(
    async () => {
      const { oldPassword, newPassword, confirmPassword } = formApi.getValues();
      await rotateSecret({ oldPassword, newPassword, confirmPassword });
    },
    {
      manual: true,
      onSuccess: () => {
        message.success({
          message: "Rotate sync secret successful",
        });
        onOk();
      },
      onError: (error) => {
        message.error({
          message: `Rotate sync secret failed: ${getErrorMessage(error)}`,
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
      <DialogTitle>Rotate Sync Secret</DialogTitle>
      <Loading loading={loading} size={32}>
        <DialogContent>
          <DialogContentText>
            Change the sync password used for encrypted snapshot restore.
          </DialogContentText>
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ mt: 4 }}>
              <Controller
                name="oldPassword"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: "Please enter old password",
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
                name="newPassword"
                control={formApi.control}
                rules={{
                  required: {
                    value: true,
                    message: "Please enter new password",
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
                    label="New Password"
                    placeholder="New Password"
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
                    message: "Please enter confirm password",
                  },
                  minLength: {
                    value: 8,
                    message: "Please enter at least 8 characters",
                  },
                  maxLength: {
                    value: 128,
                    message: "Please enter no more than 128 characters",
                  },
                  validate: (value, formValues) => {
                    if (value !== formValues.newPassword) {
                      return "The password confirmation does not match the password";
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
                    placeholder="Confirm Password"
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
              Submit
            </Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
