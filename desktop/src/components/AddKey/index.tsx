import { Button, Flex } from "@radix-ui/themes";
import { get } from "lodash-es";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { EditKeyForm, type EditKeyFormFields, useKeys } from "shared";
import { addKey, type Key, updateKey } from "tauri-plugin-data";

import PageDrawer from "@/components/PageDrawer";
import useMessage from "@/hooks/useMessage";

type AddKeyProps = {
  open?: boolean;
  data?: Key;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddKey({ open, data, onOk, onCancel }: AddKeyProps) {
  const { refresh: refreshKeys } = useKeys();
  const message = useMessage();
  const [saving, setSaving] = useState(false);
  const formApi = useForm<EditKeyFormFields>({
    defaultValues: {
      name: "",
      publicKey: "",
      privateKey: "",
      passphrase: "",
      certificate: "",
    },
    values: {
      name: data?.name ?? "",
      publicKey: data?.publicKey ?? "",
      privateKey: data?.privateKey ?? "",
      passphrase: data?.passphrase ?? "",
      certificate: data?.certificate ?? "",
    },
  });

  const onSave = useCallback(
    async (values: EditKeyFormFields) => {
      setSaving(true);
      try {
        const key = {
          name: values.name || "",
          publicKey: values.publicKey || "",
          privateKey: values.privateKey || "",
          passphrase: values.passphrase,
          certificate: values.certificate,
        };
        if (data) {
          await updateKey({
            ...key,
            id: data.id,
          });
        } else {
          await addKey(key);
        }

        await refreshKeys();
        onOk();
      } catch (err) {
        message.error({
          message: get(err, "message") || "Failed to save key",
        });
      } finally {
        setSaving(false);
      }
    },
    [data, refreshKeys, onOk, message],
  );

  useEffect(() => {
    if (open) return;
    formApi.reset();
  }, [formApi, open]);

  return (
    <PageDrawer
      loading={saving}
      open={open}
      title={data ? "Edit key" : "Add key"}
      onCancel={onCancel}
      footer={
        <Flex gap="3">
          <Button
            style={{ flex: 1 }}
            variant="outline"
            loading={saving}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            style={{ flex: 1 }}
            loading={saving}
            onClick={formApi.handleSubmit(onSave)}
          >
            {data ? "Save" : "Add"}
          </Button>
        </Flex>
      }
    >
      <EditKeyForm formApi={formApi} />
    </PageDrawer>
  );
}
