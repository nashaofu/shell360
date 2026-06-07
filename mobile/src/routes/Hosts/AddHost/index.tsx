import { Button, DropdownMenu } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME,
  DEFAULT_TERMINAL_TYPE,
  EditHostForm,
  type EditHostFormFields,
  MoreIcon,
  parseEnvs,
  stringifyEnvs,
  useHosts,
  useTerminalsAtomWithApi,
} from "shared";
import {
  AuthenticationMethod,
  addHost,
  type Host,
  updateHost,
} from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import PageDrawer from "@/components/PageDrawer";

type AddHostProps = {
  open?: boolean;
  data?: Host;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddHost({ open, data, onOk, onCancel }: AddHostProps) {
  const navigate = useNavigate();
  const { refresh: refreshHosts } = useHosts();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

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
      envs: stringifyEnvs(data?.envs),
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
        authenticationMethod,
        password:
          authenticationMethod === AuthenticationMethod.Password
            ? values.password
            : undefined,
        keyId:
          authenticationMethod === AuthenticationMethod.PublicKey ||
          authenticationMethod === AuthenticationMethod.Certificate
            ? values.keyId
            : undefined,
        startupCommand: values.startupCommand || undefined,
        terminalType: values.terminalType || DEFAULT_TERMINAL_TYPE,
        envs: parseEnvs(values.envs),
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
      const savedHost = await save(values);
      await refreshHosts();
      onOk();

      const [item] = terminalsAtomWithApi.add(savedHost);
      navigate(`/terminal/${item.uuid}`, { replace: true });
    },
    [navigate, onOk, save, refreshHosts, terminalsAtomWithApi],
  );

  const onSave = useCallback(
    async (values: EditHostFormFields) => {
      await save(values);
      await refreshHosts();
      onOk();
    },
    [onOk, refreshHosts, save],
  );

  const menus = useMemo(
    () => [
      {
        value: "Save & Connect",
        label: "Save & Connect",
        onClick: formApi.handleSubmit(onSaveAndConnect),
      },
    ],
    [formApi, onSaveAndConnect],
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Button style={{ flex: 1 }} variant="outline" onClick={onCancel}>
              Cancel
            </Button>

            <div style={{ display: "flex", flex: 1, width: "48%" }}>
              <Button
                style={{
                  flex: 1,
                  borderRadius: "var(--radius-2) 0 0 var(--radius-2)",
                }}
                onClick={formApi.handleSubmit(onSave)}
              >
                Save
              </Button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button
                    style={{
                      borderRadius: "0 var(--radius-2) var(--radius-2) 0",
                      borderLeft: "1px solid var(--accent-a5)",
                    }}
                  >
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
            </div>
          </div>
        }
      >
        <EditHostForm
          formApi={formApi}
          onOpenAddKey={() => setAddKeyOpen(true)}
        />
      </PageDrawer>
      <AddKey
        open={addKeyOpen}
        onCancel={() => setAddKeyOpen(false)}
        onOk={() => setAddKeyOpen(false)}
      />
    </>
  );
}
