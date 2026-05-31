import { Button, DropdownMenu, Flex } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME,
  DEFAULT_TERMINAL_TYPE,
  EditHostForm,
  type EditHostFormFields,
  MoreIcon,
  useHosts,
  useKeys,
  useTerminalsAtomWithApi,
} from "shared";
import {
  AuthenticationMethod,
  addHost,
  type Env,
  type Host,
  updateHost,
} from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import PageDrawer from "@/components/PageDrawer";
import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import useMessage from "@/hooks/useMessage";

type AddHostProps = {
  open?: boolean;
  data?: Host;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddHost({ open, data, onOk, onCancel }: AddHostProps) {
  const activateTerminal = useActivateTerminal();
  const { refresh: refreshHosts } = useHosts();
  const { refresh: refreshKeys } = useKeys();
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const msg = useMessage();

  const formApi = useForm<EditHostFormFields>({
    defaultValues: {
      id: undefined,
      name: "",
      tags: [],
      hostname: "",
      port: 22,
      username: "",
      authenticationMethod: AuthenticationMethod.Password,
      password: "",
      keyId: "",
      startupCommand: "",
      terminalType: DEFAULT_TERMINAL_TYPE,
      envs: "",
      jumpHostEnabled: false,
      jumpHostIds: [],
      terminalSettings: {
        fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
        fontSize: DEFAULT_TERMINAL_FONT_SIZE,
        theme: DEFAULT_TERMINAL_THEME?.name,
      },
    },
    values: {
      id: data?.id || undefined,
      name: data?.name ?? "",
      tags: data?.tags ?? [],
      hostname: data?.hostname ?? "",
      port: data?.port ?? 22,
      username: data?.username ?? "",
      authenticationMethod:
        data?.authenticationMethod ?? AuthenticationMethod.Password,
      password: data?.password ?? "",
      keyId: data?.keyId ?? "",
      startupCommand: data?.startupCommand ?? "",
      terminalType: data?.terminalType ?? DEFAULT_TERMINAL_TYPE,
      envs: data?.envs?.map((env) => `${env.key}=${env.value}`).join(",") ?? "",
      jumpHostEnabled: !!data?.jumpHostIds?.length,
      jumpHostIds: data?.jumpHostIds ?? [],
      terminalSettings: {
        fontFamily:
          data?.terminalSettings?.fontFamily ?? DEFAULT_TERMINAL_FONT_FAMILY,
        fontSize:
          data?.terminalSettings?.fontSize ?? DEFAULT_TERMINAL_FONT_SIZE,
        theme: data?.terminalSettings?.theme ?? DEFAULT_TERMINAL_THEME?.name,
      },
    },
  });

  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const save = useCallback(
    async (values: EditHostFormFields) => {
      const authenticationMethod =
        values.authenticationMethod || AuthenticationMethod.Password;
      const hostData = {
        name: values.name || "",
        tags: values.tags || [],
        hostname: values.hostname || "",
        port: Number(values.port || 22),
        username: values.username || "",
        authenticationMethod: authenticationMethod,
        password:
          authenticationMethod === AuthenticationMethod.Password
            ? data && !values.password
              ? undefined
              : values.password || ""
            : undefined,
        keyId:
          authenticationMethod === AuthenticationMethod.PublicKey ||
          authenticationMethod === AuthenticationMethod.Certificate
            ? values.keyId || ""
            : undefined,
        startupCommand: values.startupCommand || undefined,
        terminalType: values.terminalType || DEFAULT_TERMINAL_TYPE,
        envs: values.envs?.split(",").reduce<Env[]>((envs, env) => {
          const eqIdx = env.indexOf("=");
          if (eqIdx === -1) {
            return envs;
          }
          const key = env.slice(0, eqIdx).trim();
          const value = env.slice(eqIdx + 1).trim();

          if (!key) {
            return envs;
          }
          if (!value) {
            return envs;
          }
          envs.push({ key, value });
          return envs;
        }, []),
        jumpHostIds: values.jumpHostEnabled ? values.jumpHostIds : undefined,
        terminalSettings: values.terminalSettings
          ? {
              fontFamily: values.terminalSettings.fontFamily,
              fontSize: Number(values.terminalSettings.fontSize),
              theme: values.terminalSettings.theme,
            }
          : undefined,
      };

      if (data) {
        return updateHost({
          ...hostData,
          id: data.id,
        });
      }

      return addHost(hostData);
    },
    [data],
  );

  const onSaveAndConnect = useCallback(
    async (values: EditHostFormFields) => {
      try {
        const savedHost = await save(values);
        await refreshHosts();

        const [item] = terminalsAtomWithApi.add(savedHost);
        activateTerminal(item.uuid);

        onOk();
      } catch (error) {
        msg.error({
          message: `Failed to save and connect: ${error instanceof Error ? error.message : error}`,
        });
      }
    },
    [activateTerminal, onOk, save, refreshHosts, terminalsAtomWithApi, msg],
  );

  const onSave = useCallback(
    async (values: EditHostFormFields) => {
      try {
        await save(values);
        await refreshHosts();
        onOk();
      } catch (error) {
        msg.error({
          message: `Failed to save host: ${error instanceof Error ? error.message : error}`,
        });
      }
    },
    [onOk, refreshHosts, save, msg],
  );

  const onValidationError = useCallback(
    (errors: FieldErrors<EditHostFormFields>) => {
      let errorMessage = "Please fill in the required fields";
      for (const err of Object.values(errors)) {
        if (!err) continue;
        if (typeof err.message === "string") {
          errorMessage = err.message;
          break;
        }
        for (const nested of Object.values(err)) {
          if (
            nested &&
            typeof (nested as { message?: unknown }).message === "string"
          ) {
            errorMessage = (nested as { message: string }).message;
            break;
          }
        }
      }
      msg.error(errorMessage);
    },
    [msg],
  );

  const menus = useMemo(
    () => [
      {
        value: "Save & Connect",
        label: "Save & Connect",
        onClick: formApi.handleSubmit(onSaveAndConnect, onValidationError),
      },
    ],
    [formApi, onSaveAndConnect, onValidationError],
  );

  useEffect(() => {
    if (open) {
      return;
    }

    formApi.reset();
  }, [formApi, open]);

  return (
    <>
      <PageDrawer
        open={open}
        title={data ? "Edit host" : "Add host"}
        onCancel={onCancel}
        footer={
          <Flex align="center" gap="2">
            <Button style={{ flex: 1 }} variant="outline" onClick={onCancel}>
              Cancel
            </Button>

            <Flex style={{ flex: 1 }} gap="1">
              <Button
                style={{ flex: 1 }}
                onClick={formApi.handleSubmit(onSave, onValidationError)}
              >
                Save
              </Button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="soft">
                    <MoreIcon />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
                  {menus.map((item) => (
                    <DropdownMenu.Item
                      key={item.value}
                      onSelect={() => item.onClick?.()}
                    >
                      {item.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Flex>
          </Flex>
        }
      >
        <EditHostForm
          formApi={formApi}
          onOpenAddKey={() => setAddKeyOpen(true)}
          onSubmit={formApi.handleSubmit(onSave, onValidationError)}
        />
      </PageDrawer>
      <AddKey
        open={addKeyOpen}
        onCancel={() => setAddKeyOpen(false)}
        onOk={() => {
          setAddKeyOpen(false);
          refreshKeys();
        }}
      />
    </>
  );
}
