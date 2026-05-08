import { Text } from "@radix-ui/themes";
import { Controller } from "react-hook-form";

import JumpHostIdsSelect from "./JumpHostIdsSelect";
import type { EditHostFormApi } from "./types";
import styles from "./JumpHostsForm.module.less";

type JumpHostsFormProps = {
  formApi: EditHostFormApi;
  sx?: unknown;
};

export default function JumpHostsForm({ formApi, sx }: JumpHostsFormProps) {
  const jumpHostEnabled = formApi.watch("jumpHostEnabled");
  const hostId = formApi.watch("id");
  const wrapperStyle =
    sx && typeof sx === "object"
      ? (sx as { mb?: number }).mb
        ? { marginBottom: `${(sx as { mb: number }).mb * 8}px` }
        : undefined
      : undefined;

  return (
    <section className={styles.section} style={wrapperStyle}>
      <div className={styles.sectionTitleWrap}>
        <Text size="3" weight="medium">
          Jump Hosts
        </Text>
      </div>
      <Controller
        name="jumpHostEnabled"
        control={formApi.control}
        render={({ field }) => {
          return (
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={
                  !field.value
                    ? `${styles.toggleButton} ${styles.toggleButtonActive}`
                    : styles.toggleButton
                }
                onClick={() => field.onChange(false)}
              >
                Disabled
              </button>
              <button
                type="button"
                className={
                  field.value
                    ? `${styles.toggleButton} ${styles.toggleButtonActive}`
                    : styles.toggleButton
                }
                onClick={() => field.onChange(true)}
              >
                Enabled
              </button>
            </div>
          );
        }}
      />

      {jumpHostEnabled && (
        <Controller
          name="jumpHostIds"
          control={formApi.control}
          rules={{
            validate: (value) => {
              if (value?.length === 0) {
                return "Please select at least one jump host";
              }
              return true;
            },
          }}
          render={({ field, fieldState }) => (
            <JumpHostIdsSelect
              sx={{ mt: 3 }}
              value={field.value || []}
              onChange={field.onChange}
              hostId={hostId}
              error={fieldState.invalid}
              helperText={fieldState.error?.message}
            />
          )}
        />
      )}
    </section>
  );
}
