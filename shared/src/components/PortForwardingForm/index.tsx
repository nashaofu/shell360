import { Select, Text, TextField } from "@radix-ui/themes";
import { Controller, type UseFormReturn } from "react-hook-form";
import { PortForwardingType } from "tauri-plugin-data";

import { useHosts } from "@/hooks/useHosts";
import { onInputChange } from "@/utils/form";
import styles from "./index.module.less";

export type PortForwardingFormFields = {
  name: string;
  portForwardingType: PortForwardingType;
  hostId: string;
  localAddress: string;
  localPort: number | "";
  remoteAddress?: string;
  remotePort?: number | "";
};

export type PortForwardingFormProps = {
  formApi: UseFormReturn<PortForwardingFormFields>;
};

const PORT_FORWARDING_TYPES = [
  {
    label: "Local tunnel",
    value: PortForwardingType.Local,
  },
  {
    label: "Remote tunnel",
    value: PortForwardingType.Remote,
  },
  {
    label: "Dynamic tunnel",
    value: PortForwardingType.Dynamic,
  },
];

export function PortForwardingForm({ formApi }: PortForwardingFormProps) {
  const portForwardingType = formApi.watch("portForwardingType");
  const { data: hosts } = useHosts();
  const hostOptions = hosts ?? [];

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
        name="portForwardingType"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please select tunnel type",
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
              Tunnel type
            </Text>
            <Select.Root
              value={field.value || PortForwardingType.Local}
              onValueChange={(value) => field.onChange(value)}
            >
              <Select.Trigger style={{ width: "100%" }} />
              <Select.Content>
                {PORT_FORWARDING_TYPES.map((item) => (
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

      <Controller
        name="hostId"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please select host",
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
              Host
            </Text>
            <Select.Root
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value)}
            >
              <Select.Trigger
                style={{ width: "100%" }}
                placeholder="Select host"
              />
              <Select.Content>
                {hostOptions.map((item) => (
                  <Select.Item key={item.id} value={item.id}>
                    {item.name || `${item.hostname}:${item.port}`}
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

      <Controller
        name="localAddress"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter local address",
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
              Local address
            </Text>
            <TextField.Root
              value={field.value || ""}
              placeholder="Local address"
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
        name="localPort"
        control={formApi.control}
        rules={{
          required: {
            value: true,
            message: "Please enter local port",
          },
          pattern: {
            value: /^\d+$/,
            message: "Please enter the number",
          },
          min: {
            value: 1,
            message: "The local port cannot be less than 1",
          },
          max: {
            value: 65535,
            message: "The local port cannot be greater than 65535",
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
              Local port
            </Text>
            <TextField.Root
              value={field.value === undefined ? "" : field.value}
              placeholder="Local port"
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

      {portForwardingType !== PortForwardingType.Dynamic && (
        <>
          <Controller
            name="remoteAddress"
            control={formApi.control}
            rules={{
              required: {
                value: true,
                message: "Please enter remote address",
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
                  Remote address
                </Text>
                <TextField.Root
                  value={field.value || ""}
                  placeholder="Remote address"
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
            name="remotePort"
            control={formApi.control}
            rules={{
              required: {
                value: true,
                message: "Please enter remote port",
              },
              pattern: {
                value: /^\d+$/,
                message: "Please enter the number",
              },
              min: {
                value: 1,
                message: "The remote port cannot be less than 1",
              },
              max: {
                value: 65535,
                message: "The remote port cannot be greater than 65535",
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
                  Remote port
                </Text>
                <TextField.Root
                  value={field.value === undefined ? "" : field.value}
                  placeholder="Remote port"
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
        </>
      )}
    </form>
  );
}
