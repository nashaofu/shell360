import { Select, Text } from "@radix-ui/themes";
import { type ChangeEvent, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { AuthenticationMethod } from "tauri-plugin-data";

import { useKeys } from "@/hooks/useKeys";
import styles from "../styles.module.less";

export type AuthenticationFormFields = {
  username?: string;
  authenticationMethod?: AuthenticationMethod;
  password?: string;
  keyId?: string;
};

export type AuthenticationFormProps = {
  formApi: UseFormReturn<AuthenticationFormFields>;
  onOpenAddKey: () => void;
};

const ADD_KEY_VALUE = "__add_key__";

type PasswordFieldProps = {
  value?: string;
  error?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
};

function PasswordField({ value, placeholder, onChange }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.value);
  };

  return (
    <div className={styles.passwordInputRoot}>
      <span className={styles.passwordSlot}>
        <span className="icon-lock" />
      </span>
      <input
        className={styles.passwordInput}
        value={value || ""}
        type={isVisible ? "text" : "password"}
        placeholder={placeholder}
        onChange={onInputChange}
      />
      <span className={styles.passwordSlot}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setIsVisible((v) => !v)}
        >
          <span
            className={isVisible ? "icon-visibility-off" : "icon-visibility"}
          />
        </button>
      </span>
    </div>
  );
}

export function AuthenticationForm({
  formApi,
  onOpenAddKey,
}: AuthenticationFormProps) {
  const { data: keys } = useKeys();
  const keyOptions = keys ?? [];
  const authenticationMethod = formApi.watch("authenticationMethod");

  return (
    <>
      <Controller
        name="authenticationMethod"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please select authentication method",
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
              Authentication method
            </Text>
            <Select.Root
              value={field.value || AuthenticationMethod.Password}
              onValueChange={(value) => field.onChange(value)}
            >
              <Select.Trigger className={styles.fullWidthTrigger} />
              <Select.Content>
                <Select.Item value={AuthenticationMethod.Password}>
                  Password
                </Select.Item>
                <Select.Item value={AuthenticationMethod.PublicKey}>
                  PublicKey
                </Select.Item>
                <Select.Item value={AuthenticationMethod.Certificate}>
                  Certificate
                </Select.Item>
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

      {authenticationMethod === AuthenticationMethod.Password && (
        <Controller
          name="password"
          control={formApi.control}
          rules={{
            maxLength: {
              value: 100,
              message: "Please enter no more than 100 characters",
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
                Password
              </Text>
              <PasswordField
                value={field.value}
                error={fieldState.invalid}
                placeholder="Password"
                onChange={field.onChange}
              />
              {fieldState.invalid && (
                <Text size="1" className={styles.errorHint}>
                  {fieldState.error?.message}
                </Text>
              )}
            </div>
          )}
        />
      )}

      {(authenticationMethod === AuthenticationMethod.PublicKey ||
        authenticationMethod === AuthenticationMethod.Certificate) && (
        <Controller
          name="keyId"
          control={formApi.control}
          rules={{
            required: {
              value: true,
              message: "Please select key",
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
                Key
              </Text>
              <Select.Root
                value={field.value || ""}
                onValueChange={(value) => {
                  if (value === ADD_KEY_VALUE) {
                    onOpenAddKey();
                    return;
                  }

                  field.onChange(value);
                }}
              >
                <Select.Trigger
                  className={styles.fullWidthTrigger}
                  placeholder="Select key"
                />
                <Select.Content>
                  <Select.Item value={ADD_KEY_VALUE}>+ Add key</Select.Item>
                  {keyOptions.map((item) => (
                    <Select.Item key={item.id} value={item.id}>
                      {item.name}
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
    </>
  );
}
