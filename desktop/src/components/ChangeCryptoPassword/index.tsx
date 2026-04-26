import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loading } from "shared";
import { changeCryptoPassword } from "tauri-plugin-data";

import CryptoPasswordField from "@/components/CryptoPasswordField";
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
          message: "Encryption password changed successfully",
        });
        onOk();
      },
      onError: () => {
        message.error({
          message: "Failed to change encryption password",
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
      <Dialog.Content style={{ maxWidth: 420 }}>
        <Dialog.Title>Change Encryption Password</Dialog.Title>
        <Loading loading={loading} size={32}>
          <Dialog.Description size="2" color="gray">
            Enter your current password and choose a new one to re-encrypt your
            application data.
          </Dialog.Description>
          <form noValidate autoComplete="off">
            <Flex direction="column" gap="4" mt="4">
              <CryptoPasswordField
                control={formApi.control}
                name="oldPassword"
                label="Old Password"
                placeholder="Old password"
                requiredMessage="Please enter old password"
              />
              <CryptoPasswordField
                control={formApi.control}
                name="password"
                label="Password"
                placeholder="Password"
                requiredMessage="Please enter password"
              />
              <CryptoPasswordField
                control={formApi.control}
                name="confirmPassword"
                label="Confirm Password"
                placeholder="Confirm password"
                requiredMessage="Please enter confirm password"
                matchField="password"
              />
            </Flex>
          </form>
          <Flex gap="3" justify="end" mt="4">
            <Button variant="outline" disabled={loading} onClick={onCancel}>
              Cancel
            </Button>
            <Button loading={loading} onClick={formApi.handleSubmit(onSubmit)}>
              Submit
            </Button>
          </Flex>
        </Loading>
      </Dialog.Content>
    </Dialog.Root>
  );
}
