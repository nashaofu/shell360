import { IconButton, Text, TextArea, TextField } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { type ChangeEvent, useCallback } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import type { Key } from "tauri-plugin-data";

import { TextFieldPassword } from "../TextFieldPassword";
import styles from "./index.module.less";

export type EditKeyFormFields = Partial<Omit<Key, "id">>;

export type EditKeyFormProps = {
  formApi: UseFormReturn<EditKeyFormFields>;
};

export function EditKeyForm({ formApi }: EditKeyFormProps) {
  const importPrivatekey = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: false,
    });

    if (!file) {
      return;
    }

    const text = await readTextFile(file);

    const filename = file.split(/[\\/]/).pop() || "";
    formApi.setValue("name", filename);
    formApi.setValue("privateKey", text);
  }, [formApi]);

  const importPublicKey = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: false,
    });

    if (!file) {
      return;
    }

    const text = await readTextFile(file);

    formApi.setValue("publicKey", text);
  }, [formApi]);

  const importCertificate = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: false,
    });

    if (!file) {
      return;
    }

    const text = await readTextFile(file);

    formApi.setValue("certificate", text);
  }, [formApi]);

  const onInputChange =
    (onChange: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    };

  const onTextareaChange =
    (onChange: (value: string) => void) =>
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    };

  return (
    <form className={styles.form} noValidate autoComplete="off">
      <Controller
        name="name"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter name",
          },
          minLength: {
            value: 1,
            message: "Please enter at least 1 characters",
          },
          maxLength: {
            value: 60,
            message: "Please enter no more than 60 characters",
          },
        }}
        render={({ field, fieldState }) => (
          <div className={styles.formField}>
            <Text
              as="label"
              size="2"
              weight="medium"
              className={styles.fieldLabel}
            >
              Name
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="Name"
              onChange={onInputChange(field.onChange)}
            />
            {fieldState.invalid && (
              <Text size="1" className={styles.errorHint}>
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />
      <Controller
        name="privateKey"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter private key",
          },
        }}
        render={({ field, fieldState }) => (
          <div className={styles.formField}>
            <div className={styles.fieldHeader}>
              <Text
                as="label"
                size="2"
                weight="medium"
                className={styles.fieldLabel}
              >
                Private key
              </Text>
              <IconButton
                type="button"
                variant="outline"
                color="gray"
                onClick={importPrivatekey}
              >
                <span className="icon-file-upload" />
              </IconButton>
            </div>
            <TextArea
              value={field.value || ""}
              placeholder="Private key"
              rows={6}
              onChange={onTextareaChange(field.onChange)}
            />
            {fieldState.invalid && (
              <Text size="1" className={styles.errorHint}>
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />
      <Controller
        name="publicKey"
        control={formApi.control}
        render={({ field, fieldState }) => (
          <div className={styles.formField}>
            <div className={styles.fieldHeader}>
              <Text
                as="label"
                size="2"
                weight="medium"
                className={styles.fieldLabel}
              >
                Public key
              </Text>
              <IconButton
                type="button"
                variant="outline"
                color="gray"
                onClick={importPublicKey}
              >
                <span className="icon-file-upload" />
              </IconButton>
            </div>
            <TextArea
              value={field.value || ""}
              placeholder="Public key"
              rows={6}
              onChange={onTextareaChange(field.onChange)}
            />
            {fieldState.invalid && (
              <Text size="1" className={styles.errorHint}>
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />
      <Controller
        name="passphrase"
        control={formApi.control}
        render={({ field, fieldState }) => (
          <div className={styles.formField}>
            <TextFieldPassword
              {...field}
              sx={undefined}
              className={styles.formFieldInput}
              fullWidth
              label="Passphrase"
              placeholder="Passphrase"
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            />
          </div>
        )}
      />
      <Controller
        name="certificate"
        control={formApi.control}
        render={({ field, fieldState }) => (
          <div className={styles.formField}>
            <div className={styles.fieldHeader}>
              <Text
                as="label"
                size="2"
                weight="medium"
                className={styles.fieldLabel}
              >
                Certificate
              </Text>
              <IconButton
                type="button"
                variant="outline"
                color="gray"
                onClick={importCertificate}
              >
                <span className="icon-file-upload" />
              </IconButton>
            </div>
            <TextArea
              value={field.value || ""}
              placeholder="Certificate"
              rows={6}
              onChange={onTextareaChange(field.onChange)}
            />
            {fieldState.invalid && (
              <Text size="1" className={styles.errorHint}>
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />
    </form>
  );
}
