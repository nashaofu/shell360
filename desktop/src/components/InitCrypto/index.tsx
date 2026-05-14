import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { Controller, useForm } from "react-hook-form";
import { Loading, TextFieldPassword } from "shared";
import { changeCryptoEnable } from "tauri-plugin-data";

import useMessage from "@/hooks/useMessage";

interface IniCryptoProps {
  open: boolean;
  onCancel: () => unknown;
  onOk: () => unknown;
}

export default function IniCrypto({ open, onCancel, onOk }: IniCryptoProps) {
  const message = useMessage();
  const formApi = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
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
            message: "Initialization of crypto success",
          });
          onOk();
        },
        onError: () => {
          message.error({
            message: "Initialization of crypto failed",
          });
        },
      },
    );

  const loading = initCryptoPasswordLoading;

  return (
    <Dialog.Root open={open}>
      <Dialog.Content>
        <Dialog.Title>Initialize Crypto</Dialog.Title>
        <Loading loading={loading} size={48}>
          <Dialog.Description>
            Set an encrypted password to protect application data
          </Dialog.Description>
          <form noValidate autoComplete="off">
            <Flex direction="column" gap="4" mt="5">
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
            </Flex>
          </form>
          <Flex gap="3" justify="end" mt="4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={formApi.handleSubmit(onInitCryptoPassword)}>
              Submit
            </Button>
          </Flex>
        </Loading>
      </Dialog.Content>
    </Dialog.Root>
  );
}
