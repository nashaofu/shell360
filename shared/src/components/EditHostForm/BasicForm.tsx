import { IconButton, Select, Text, TextField } from "@radix-ui/themes";
import { type KeyboardEvent, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { AuthenticationMethod } from "tauri-plugin-data";

import { useHosts } from "@/hooks/useHosts";
import { useKeys } from "@/hooks/useKeys";
import { validateEnvs } from "@/utils/env";
import { onInputChange } from "@/utils/form";
import { resolveSpacing } from "@/utils/style";

import {
  CodeIcon,
  HostIcon,
  NumberIcon,
  UserIcon,
  VariableIcon,
} from "../Icon";
import { TextFieldPassword } from "../TextFieldPassword";
import styles from "./BasicForm.module.less";
import { TERMINAL_TYPES } from "./terminalTypes";
import type { EditHostFormApi } from "./types";

type BasicFormProps = {
  formApi: EditHostFormApi;
  sx?: unknown;
  onOpenAddKey: () => void;
};

const ADD_KEY_VALUE = "__ADD_KEY__";

export default function BasicForm({
  formApi,
  sx,
  onOpenAddKey,
}: BasicFormProps) {
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();
  const authenticationMethod = formApi.watch("authenticationMethod");
  const [tagInput, setTagInput] = useState("");
  const [tagInputFocused, setTagInputFocused] = useState(false);

  const wrapperStyle = resolveSpacing(sx);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const host of hosts) {
      if (Array.isArray(host.tags)) {
        for (const tag of host.tags) {
          if (tag?.trim()) {
            set.add(tag.trim());
          }
        }
      }
    }
    return Array.from(set);
  }, [hosts]);

  const onTagsInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    values: string[],
    onChange: (value: string[]) => void,
  ) => {
    if (event.key !== "Enter" && event.key !== ",") {
      return;
    }

    event.preventDefault();
    const nextTag = tagInput.replace(/,$/, "").trim();
    if (!nextTag || values.includes(nextTag)) {
      setTagInput("");
      return;
    }

    onChange([...values, nextTag]);
    setTagInput("");
  };

  const commitTagInput = (
    values: string[],
    onChange: (value: string[]) => void,
  ) => {
    const nextTag = tagInput.replace(/,$/, "").trim();
    if (nextTag && !values.includes(nextTag)) {
      onChange([...values, nextTag]);
    }
    setTagInput("");
  };

  return (
    <section className={styles.section} style={wrapperStyle}>
      <Controller
        name="name"
        control={formApi.control}
        rules={{
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
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />

      <Controller
        name="tags"
        control={formApi.control}
        rules={{
          maxLength: {
            value: 60,
            message: "Please enter no more than 60 characters",
          },
        }}
        render={({ field, fieldState }) => {
          const values = Array.isArray(field.value) ? field.value : [];

          const onRemoveTag = (tag: string) => {
            field.onChange(values.filter((item) => item !== tag));
          };

          const suggestedTags = tags.filter(
            (tag) =>
              !values.includes(tag) &&
              (!tagInput.trim() ||
                tag.toLowerCase().includes(tagInput.toLowerCase().trim())),
          );

          return (
            <div className={styles.formField}>
              <Text
                as="label"
                size="2"
                weight="medium"
                className={styles.fieldLabel}
              >
                Tags
              </Text>
              <div className={styles.tagsFieldWrapper}>
                <div
                  className={`${styles.tagsWrap} ${tagInputFocused ? styles.tagsWrapFocused : ""}`}
                >
                  {values.map((tag) => (
                    <span key={tag} className={styles.tagChip}>
                      {tag}
                      <IconButton
                        type="button"
                        variant="ghost"
                        color="gray"
                        size="1"
                        onClick={() => onRemoveTag(tag)}
                        aria-label="Remove tag"
                      >
                        ×
                      </IconButton>
                    </span>
                  ))}
                  <input
                    className={styles.tagInput}
                    value={tagInput}
                    placeholder={
                      values.length ? "" : "Type tag and press Enter"
                    }
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) =>
                      onTagsInputKeyDown(event, values, field.onChange)
                    }
                    onFocus={() => setTagInputFocused(true)}
                    onBlur={() => {
                      setTagInputFocused(false);
                      commitTagInput(values, field.onChange);
                    }}
                  />
                </div>
                {tagInputFocused && suggestedTags.length > 0 && (
                  <div className={styles.tagsSuggestions}>
                    {suggestedTags.map((tag) => (
                      <span
                        key={tag}
                        className={styles.tagSuggestionChip}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          field.onChange([...values, tag]);
                          setTagInput("");
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {fieldState.invalid && (
                <Text size="1" color="red" as="p" mt="1">
                  {fieldState.error?.message}
                </Text>
              )}
            </div>
          );
        }}
      />

      <Controller
        name="hostname"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter hostname",
          },
          minLength: {
            value: 3,
            message: "Please enter at least 3 characters",
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
              Hostname
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="Hostname"
              onChange={onInputChange(field.onChange)}
            >
              <TextField.Slot>
                <HostIcon aria-hidden="true" />
              </TextField.Slot>
            </TextField.Root>
            {fieldState.invalid && (
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />

      <Controller
        name="port"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter port",
          },
          pattern: {
            value: /^\d+$/,
            message: "Please enter the number",
          },
          min: {
            value: 1,
            message: "The port cannot be less than 1",
          },
          max: {
            value: 65535,
            message: "The port cannot be greater than 65535",
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
              Port
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="Port"
              type="number"
              onChange={onInputChange(field.onChange)}
            >
              <TextField.Slot>
                <NumberIcon aria-hidden="true" />
              </TextField.Slot>
            </TextField.Root>
            {fieldState.invalid && (
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />

      <Controller
        name="username"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter username",
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
              Username
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="Username"
              onChange={onInputChange(field.onChange)}
            >
              <TextField.Slot>
                <UserIcon aria-hidden="true" />
              </TextField.Slot>
            </TextField.Root>
            {fieldState.invalid && (
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />

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
              value={field.value || ""}
              onValueChange={field.onChange}
            >
              <Select.Trigger
                style={{ width: "100%" }}
                placeholder="Authentication method"
              />
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
              <Text size="1" color="red" as="p" mt="1">
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
              <TextFieldPassword
                {...field}
                fullWidth
                label="Password"
                placeholder="Password"
                error={fieldState.invalid}
                helperText={fieldState.error?.message}
              />
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
                <Select.Trigger style={{ width: "100%" }} placeholder="Key" />
                <Select.Content>
                  <Select.Item value={ADD_KEY_VALUE}>+ Add key</Select.Item>
                  {keys.map((item) => (
                    <Select.Item key={item.id} value={item.id}>
                      {item.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {fieldState.invalid && (
                <Text size="1" color="red" as="p" mt="1">
                  {fieldState.error?.message}
                </Text>
              )}
            </div>
          )}
        />
      )}

      <Controller
        name="startupCommand"
        control={formApi.control}
        rules={{
          maxLength: {
            value: 500,
            message: "Please enter no more than 500 characters",
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
              Startup Command
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="Command to execute after connection (optional)"
              onChange={onInputChange(field.onChange)}
            >
              <TextField.Slot>
                <CodeIcon aria-hidden="true" />
              </TextField.Slot>
            </TextField.Root>
            {fieldState.invalid && (
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />

      <Controller
        name="terminalType"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please select terminal type",
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
              Terminal type
            </Text>
            <Select.Root
              value={field.value || ""}
              onValueChange={field.onChange}
            >
              <Select.Trigger
                style={{ width: "100%" }}
                placeholder="Terminal type"
              />
              <Select.Content>
                {TERMINAL_TYPES.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {fieldState.invalid && (
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />

      <Controller
        name="envs"
        control={formApi.control}
        rules={{
          validate: validateEnvs,
        }}
        render={({ field, fieldState }) => (
          <div className={styles.formField}>
            <Text
              as="label"
              size="2"
              weight="medium"
              className={styles.fieldLabel}
            >
              Environment variables
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="e.g. KEY1=VALUE1,KEY2=VALUE2"
              onChange={onInputChange(field.onChange)}
            >
              <TextField.Slot>
                <VariableIcon aria-hidden="true" />
              </TextField.Slot>
            </TextField.Root>
            {fieldState.invalid && (
              <Text size="1" color="red" as="p" mt="1">
                {fieldState.error?.message}
              </Text>
            )}
          </div>
        )}
      />
    </section>
  );
}
