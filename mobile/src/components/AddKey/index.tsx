import { Button } from "@radix-ui/themes";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditKeyForm, type EditKeyFormFields, useKeys } from "shared";
import { addKey, type Key, updateKey } from "tauri-plugin-data";

import PageDrawer from "../PageDrawer";

type AddKeyProps = {
  open?: boolean;
  data?: Key;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddKey({ open, data, onOk, onCancel }: AddKeyProps) {
  const { refresh: refreshKeys } = useKeys();
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

  const importTextFile = useCallback(async () => {
    const file = await openDialog({
      multiple: false,
      directory: false,
    });
    if (!file) {
      return undefined;
    }

    return {
      filename: file.split(/[\\/]/).pop() || "",
      content: await readTextFile(file),
    };
  }, []);

  const onSave = useCallback(
    async (values: EditKeyFormFields) => {
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
    },
    [data, refreshKeys, onOk],
  );

  useEffect(() => {
    if (open) {
      return;
    }

    formApi.reset();
  }, [formApi, open]);

  return (
    <PageDrawer
      open={open}
      title={data ? "Edit key" : "Add key"}
      onCancel={onCancel}
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Button style={{ width: "48%" }} variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            style={{ width: "48%" }}
            onClick={formApi.handleSubmit(onSave)}
          >
            Save
          </Button>
        </div>
      }
    >
      <EditKeyForm formApi={formApi} onImportTextFile={importTextFile} />
    </PageDrawer>
  );
}
