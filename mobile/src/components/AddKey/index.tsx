import { Button } from "@radix-ui/themes";
import { hasCapability } from "bridge/capabilities";
import { addKey, type Key, updateKey } from "bridge/data";
import { open as openDialog } from "bridge/dialog";
import { readTextFile } from "bridge/fs";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { EditKeyForm, type EditKeyFormFields, useKeys } from "shared";

import PageDrawer, { PageDrawerActions } from "../PageDrawer";

type AddKeyProps = {
  open?: boolean;
  data?: Key;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddKey({ open, data, onOk, onCancel }: AddKeyProps) {
  const canImportFile =
    hasCapability("fileDialog") && hasCapability("fileSystem");
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
      filename:
        (file.startsWith("content://") ? decodeURIComponent(file) : file)
          .split(/[\\/:]/)
          .pop() || "",
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
        <PageDrawerActions>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          <Button onClick={formApi.handleSubmit(onSave)}>Save</Button>
        </PageDrawerActions>
      }
    >
      <EditKeyForm
        formApi={formApi}
        onImportTextFile={canImportFile ? importTextFile : undefined}
      />
    </PageDrawer>
  );
}
