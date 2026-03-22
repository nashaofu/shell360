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
import { Loading } from "shared";

import useMessage from "@/hooks/useMessage";

interface RemoteSyncConfigProps {
  open: boolean;
  baseUrl: string;
  onCancel: () => unknown;
  onOk: (baseUrl: string) => Promise<unknown> | unknown;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

export default function RemoteSyncConfig({
  open,
  baseUrl,
  onCancel,
  onOk,
}: RemoteSyncConfigProps) {
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      baseUrl,
    },
  });

  const { run: onSubmit, loading } = useRequest(
    async () => {
      const values = formApi.getValues();
      await onOk(values.baseUrl.trim());
    },
    {
      manual: true,
      onSuccess: () => {
        message.success({
          message: "Save remote sync config successful",
        });
      },
      onError: (error) => {
        message.error({
          message: `Save remote sync config failed: ${getErrorMessage(error)}`,
        });
      },
    },
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    formApi.reset({ baseUrl });
  }, [baseUrl, formApi, open]);

  return (
    <Dialog open={open} onClose={() => onCancel()}>
      <DialogTitle>Remote Sync Config</DialogTitle>
      <Loading loading={loading} size={32}>
        <DialogContent>
          <DialogContentText>
            Configure the cloud sync server base URL.
          </DialogContentText>
          <Box component="form" noValidate autoComplete="off" sx={{ mt: 4 }}>
            <Controller
              name="baseUrl"
              control={formApi.control}
              rules={{
                required: {
                  value: true,
                  message: "Please enter base URL",
                },
              }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label="Base URL"
                  placeholder="https://sync.example.com"
                  error={fieldState.invalid}
                  helperText={fieldState.error?.message}
                ></TextField>
              )}
            />
          </Box>
          <DialogActions sx={{ pt: 4 }}>
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={formApi.handleSubmit(onSubmit)}
            >
              Save
            </Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
