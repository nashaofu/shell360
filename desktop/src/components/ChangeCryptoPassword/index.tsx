import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Loading, TextFieldPassword } from "shared";
import { changeCryptoPassword } from "tauri-plugin-data";

import useMessage from "@/hooks/useMessage";

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
      oldPassword: "",
      password: "",
      confirmPassword: "",
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
          message: "Change crypto password success",
        });
        onOk();
      },
      onError: () => {
        message.error({
          message: "Change crypto password failed",
        });
      },
    },
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    formApi.reset();
  }, [open, formApi]);

  return (
    <Dialog.Root open={open}>
      <Dialog.Content>
        <Dialog.Title>Change Crypto Password</Dialog.Title>
        <Loading loading={loading} size={32}>
          <Dialog.Description>
            Please enter the encryption password to reset the key
          </Dialog.Description>
          <form noValidate autoComplete="off">
            <div style={{ marginTop: 16 }}>
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
            </div>
            <div style={{ marginTop: 16 }}>
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
            </div>
            <div style={{ marginTop: 16 }}>
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
                    if (value !== formValues.password) {
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
                    placeholder="Confirm password"
                    error={fieldState.invalid}
                    helperText={fieldState.error?.message}
                  ></TextFieldPassword>
                )}
              ></Controller>
            </div>
          </form>
          <Flex gap="3" justify="end" mt="4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={formApi.handleSubmit(onSubmit)}>Submit</Button>
          </Flex>
        </Loading>
      </Dialog.Content>
    </Dialog.Root>
  );
}
