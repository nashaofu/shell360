import { Button, Flex } from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { get } from "lodash-es";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { GenerateKeyForm, type GenerateKeyFormFields, useKeys } from "shared";
import { addKey } from "tauri-plugin-data";

import PageDrawer from "@/components/PageDrawer";
import useMessage from "@/hooks/useMessage";

type GenerateKeyProps = {
  open?: boolean;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function GenerateKey({
  open,
  onOk,
  onCancel,
}: GenerateKeyProps) {
  const { refresh: refreshKeys } = useKeys();
  const message = useMessage();
  const formApi = useForm<GenerateKeyFormFields>({
    defaultValues: {
      name: "",
      algorithm: "",
      bitSize: "",
      curve: "",
      passphrase: "",
    },
  });

  const [loading, setLoading] = useState(false);

  const onGenerate = useCallback(
    async (values: GenerateKeyFormFields) => {
      setLoading(true);
      try {
        const { privateKey, publicKey } = await invoke<{
          privateKey: string;
          publicKey: string;
        }>("generate_key", {
          algorithm: {
            type: values.algorithm,
            bitSize: values.bitSize,
            curve: values.curve,
          },
          passphrase: values.passphrase,
        });

        await addKey({
          name: values.name,
          privateKey,
          publicKey,
          passphrase: values.passphrase,
        });

        await refreshKeys();
        onOk();
      } catch (err) {
        message.error({
          message: get(err, "message") || "Failed to generate key",
        });
      } finally {
        setLoading(false);
      }
    },
    [refreshKeys, onOk, message],
  );

  useEffect(() => {
    if (open) return;
    formApi.reset();
  }, [formApi, open]);

  return (
    <PageDrawer
      loading={loading}
      open={open}
      title="Generate key"
      onCancel={onCancel}
      footer={
        <Flex gap="3">
          <Button
            style={{ flex: 1 }}
            variant="outline"
            loading={loading}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            style={{ flex: 1 }}
            loading={loading}
            onClick={formApi.handleSubmit(onGenerate)}
          >
            Generate
          </Button>
        </Flex>
      }
    >
      <GenerateKeyForm formApi={formApi} />
    </PageDrawer>
  );
}
