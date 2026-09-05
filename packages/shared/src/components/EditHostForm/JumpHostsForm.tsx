import { SegmentedControl, Text } from "@radix-ui/themes";
import { Controller } from "react-hook-form";

import { resolveSpacing } from "@/utils/style";
import JumpHostIdsSelect from "./JumpHostIdsSelect";
import styles from "./JumpHostsForm.module.less";
import type { EditHostFormApi } from "./types";

type JumpHostsFormProps = {
  formApi: EditHostFormApi;
  sx?: unknown;
};

export default function JumpHostsForm({ formApi, sx }: JumpHostsFormProps) {
  const jumpHostEnabled = formApi.watch("jumpHostEnabled");
  const hostId = formApi.watch("id");
  const wrapperStyle = resolveSpacing(sx);

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
            <SegmentedControl.Root
              style={{ width: "100%" }}
              value={field.value ? "true" : "false"}
              onValueChange={(v) => field.onChange(v === "true")}
            >
              <SegmentedControl.Item value="false">
                Disabled
              </SegmentedControl.Item>
              <SegmentedControl.Item value="true">
                Enabled
              </SegmentedControl.Item>
            </SegmentedControl.Root>
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
