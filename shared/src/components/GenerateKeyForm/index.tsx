import { Select, Text, TextField } from "@radix-ui/themes";
import { useCallback } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { onInputChange } from "@/utils/form";
import { TextFieldPassword } from "../TextFieldPassword";
import styles from "./index.module.less";

enum Algorithm {
  Ed25519 = "Ed25519",
  Rsa = "Rsa",
  Ecdsa = "Ecdsa",
}

const ALGORITHM_MENUS = [
  { label: "ed25519", value: Algorithm.Ed25519 },
  { label: "rsa", value: Algorithm.Rsa },
  { label: "ecdsa", value: Algorithm.Ecdsa },
];

const RSA_BIT_SIZE = [
  { label: "2048", value: 2048 },
  { label: "4096", value: 4096 },
];

const ECDSA_CURVE = [
  { label: "NIST P-256", value: "NistP256" },
  { label: "NIST P-384", value: "NistP384" },
  { label: "NIST P-521", value: "NistP521" },
];

export type GenerateKeyFormFields = {
  name: string;
  algorithm: Algorithm | "";
  bitSize?: 2048 | 4096 | "";
  curve?: "NistP256" | "NistP384" | "NistP521" | "";
  passphrase?: string;
};

export type GenerateKeyFormProps = {
  formApi: UseFormReturn<GenerateKeyFormFields>;
};

export function GenerateKeyForm({ formApi }: GenerateKeyFormProps) {
  const algorithm = formApi.watch("algorithm");

  const onAlgorithmChange = useCallback(
    (value: string) => {
      formApi.setValue("algorithm", value as Algorithm);
      if (value !== Algorithm.Rsa) {
        formApi.setValue("bitSize", "");
      }
      if (value !== Algorithm.Ecdsa) {
        formApi.setValue("curve", "");
      }
    },
    [formApi],
  );

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
        defaultValue=""
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
        name="algorithm"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please select algorithm",
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
              Algorithm
            </Text>
            <Select.Root
              value={field.value || ""}
              onValueChange={onAlgorithmChange}
            >
              <Select.Trigger
                style={{ width: "100%" }}
                placeholder="Select algorithm"
              />
              <Select.Content>
                {ALGORITHM_MENUS.map((item) => (
                  <Select.Item key={item.value} value={item.value}>
                    {item.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {fieldState.invalid && (
              <Text size="1" className={styles.errorHint}>
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />
      {algorithm === Algorithm.Rsa && (
        <Controller
          name="bitSize"
          control={formApi.control}
          rules={{
            required: {
              value: true,
              message: "Please select bit size",
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
                Bit size
              </Text>
              <Select.Root
                value={field.value ? String(field.value) : ""}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <Select.Trigger
                  style={{ width: "100%" }}
                  placeholder="Select bit size"
                />
                <Select.Content>
                  {RSA_BIT_SIZE.map((item) => (
                    <Select.Item key={item.value} value={String(item.value)}>
                      {item.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {fieldState.invalid && (
                <Text size="1" className={styles.errorHint}>
                  {fieldState.error?.message}
                </Text>
              )}
            </div>
          )}
        />
      )}
      {algorithm === Algorithm.Ecdsa && (
        <Controller
          name="curve"
          control={formApi.control}
          rules={{
            required: {
              value: true,
              message: "Please select curve",
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
                Curve
              </Text>
              <Select.Root
                value={field.value || ""}
                onValueChange={(value) => field.onChange(value)}
              >
                <Select.Trigger
                  style={{ width: "100%" }}
                  placeholder="Select curve"
                />
                <Select.Content>
                  {ECDSA_CURVE.map((item) => (
                    <Select.Item key={item.value} value={item.value}>
                      {item.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {fieldState.invalid && (
                <Text size="1" className={styles.errorHint}>
                  {fieldState.error?.message}
                </Text>
              )}
            </div>
          )}
        />
      )}
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
    </form>
  );
}
