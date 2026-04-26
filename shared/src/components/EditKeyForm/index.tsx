import { IconButton, Text, TextArea, TextField } from "@radix-ui/themes";
import { useCallback } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import type { Key } from "tauri-plugin-data";

import { onInputChange, onTextareaChange } from "@/utils/form";
import { FileUploadIcon } from "../Icon";
import { TextFieldPassword } from "../TextFieldPassword";
import styles from "./index.module.less";

export type EditKeyFormFields = Partial<Omit<Key, "id">>;

export type EditKeyFormProps = {
  formApi: UseFormReturn<EditKeyFormFields>;
  onImportTextFile?: () => Promise<
    | {
        filename: string;
        content: string;
      }
    | undefined
  >;
};

export function EditKeyForm({ formApi, onImportTextFile }: EditKeyFormProps) {
  const importPrivateKey = useCallback(async () => {
    const file = await onImportTextFile?.();
    if (!file) {
      return;
    }
    if (!formApi.getValues("name")) {
      formApi.setValue("name", file.filename);
    }
    formApi.setValue("privateKey", file.content);
  }, [formApi, onImportTextFile]);

  const importPublicKey = useCallback(async () => {
    const file = await onImportTextFile?.();
    if (!file) {
      return;
    }
    formApi.setValue("publicKey", file.content);
  }, [formApi, onImportTextFile]);

  const importCertificate = useCallback(async () => {
    const file = await onImportTextFile?.();
    if (!file) {
      return;
    }
    formApi.setValue("certificate", file.content);
  }, [formApi, onImportTextFile]);

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
                disabled={!onImportTextFile}
                onClick={importPrivateKey}
              >
                <FileUploadIcon />
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
                disabled={!onImportTextFile}
                onClick={importPublicKey}
              >
                <FileUploadIcon />
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
                disabled={!onImportTextFile}
                onClick={importCertificate}
              >
                <FileUploadIcon />
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
