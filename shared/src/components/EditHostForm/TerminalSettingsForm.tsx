import { Select, Text } from "@radix-ui/themes";
import { type ChangeEvent } from "react";
import { Controller } from "react-hook-form";

import { TERMINAL_THEMES } from "../XTerminal/themes";

import type { EditHostFormApi } from "./types";
import styles from "./TerminalSettingsForm.module.less";

type TerminalSettingsFormProps = {
  formApi: EditHostFormApi;
  sx?: unknown;
};

export default function TerminalSettingsForm({
  formApi,
  sx,
}: TerminalSettingsFormProps) {
  const wrapperStyle =
    sx && typeof sx === "object"
      ? (sx as { mb?: number }).mb
        ? { marginBottom: `${(sx as { mb: number }).mb * 8}px` }
        : undefined
      : undefined;

  const onInputChange =
    (onChange: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    };

  return (
    <section className={styles.section} style={wrapperStyle}>
      <div className={styles.sectionTitleWrap}>
        <Text size="3" weight="medium">
          Terminal Settings
        </Text>
      </div>

      <Controller
        name="terminalSettings.fontFamily"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter font family",
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
              Font family
            </Text>
            <input
              className={styles.input}
              value={field.value || ""}
              placeholder="Font family"
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
        name="terminalSettings.fontSize"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter font size",
          },
          pattern: {
            value: /^\d+$/,
            message: "Please enter the number",
          },
          min: {
            value: 10,
            message: "The font size cannot be less than 10",
          },
          max: {
            value: 48,
            message: "The font size cannot be greater than 48",
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
              Font size
            </Text>
            <input
              className={styles.input}
              value={field.value || ""}
              placeholder="Font size"
              type="number"
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
        name="terminalSettings.theme"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please select theme",
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
              Theme
            </Text>
            <Select.Root
              value={field.value || ""}
              onValueChange={field.onChange}
            >
              <Select.Trigger
                className={styles.fullWidthTrigger}
                placeholder="Select theme"
              />
              <Select.Content>
                {TERMINAL_THEMES.map((item) => (
                  <Select.Item key={item.name} value={item.name}>
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
    </section>
  );
}
