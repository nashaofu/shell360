import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonGroup, Icon } from '@mui/material';
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME,
  useHosts,
  EditHostForm,
  type EditHostFormFields,
  DEFAULT_TERMINAL_TYPE,
} from 'shared';
import {
  AuthenticationMethod,
  type Host,
  addHost,
  updateHost,
} from 'tauri-plugin-data';
import { Dropdown } from 'shared';

import { useTerminalsAtomWithApi } from '@/atom/terminalsAtom';
import PageDrawer from '@/components/PageDrawer';
import AddKey from '@/components/AddKey';

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
      name: '',
      tags: [],
      hostname: '',
      port: 22,
      username: '',
      authenticationMethod: AuthenticationMethod.Password,
      password: '',
      keyId: '',
      startupCommand: '',
      terminalType: DEFAULT_TERMINAL_TYPE,
      envs: '',
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
      name: data?.name ?? '',
      tags: data?.tags ?? [],
      hostname: data?.hostname ?? '',
      port: data?.port ?? 22,
      username: data?.username ?? '',
      authenticationMethod:
        data?.authenticationMethod ?? AuthenticationMethod.Password,
      password: data?.password ?? '',
      keyId: data?.keyId ?? '',
      startupCommand: data?.startupCommand ?? '',
      terminalType: data?.terminalType ?? DEFAULT_TERMINAL_TYPE,
      envs: data?.envs ?? '',
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
        name: values.name || '',
        tags: values.tags || [],
        hostname: values.hostname || '',
        port: Number(values.port || 22),
        username: values.username || '',
        authenticationMethod: authenticationMethod,
        password:
          authenticationMethod === AuthenticationMethod.Password
            ? values.password || ''
            : undefined,
        keyId:
          authenticationMethod === AuthenticationMethod.PublicKey ||
          authenticationMethod === AuthenticationMethod.Certificate
            ? values.keyId || ''
            : undefined,
        startupCommand: values.startupCommand || undefined,
        terminalType: values.terminalType || DEFAULT_TERMINAL_TYPE,
        envs: values.envs || undefined,
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
    [data]
  );

  const onSaveAndConnect = useCallback(
    async (values: EditHostFormFields) => {
      const savedHost = await save(values);
      await refreshHosts();
      onOk();

      const [item] = terminalsAtomWithApi.add(savedHost);
      navigate(`/terminal/${item.uuid}`, { replace: true });
    },
    [navigate, onOk, save, refreshHosts, terminalsAtomWithApi]
  );

  const onSave = useCallback(
    async (values: EditHostFormFields) => {
      await save(values);
      await refreshHosts();
      onOk();
    },
    [onOk, refreshHosts, save]
  );

  const menus = useMemo(
    () => [
      {
        value: 'Save & Connect',
        label: 'Save & Connect',
        onClick: formApi.handleSubmit(onSaveAndConnect),
      },
    ],
    [formApi, onSaveAndConnect]
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
        title={data ? 'Edit host' : 'Add host'}
        onCancel={onCancel}
        footer={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Button
              sx={{
                width: '48%',
              }}
              variant="outlined"
              onClick={onCancel}
            >
              Cancel
            </Button>

            <Dropdown
              sx={{
                width: '48%',
              }}
              menus={menus}
            >
              {({ onChangeOpen }) => (
                <ButtonGroup fullWidth variant="contained">
                  <Button fullWidth onClick={formApi.handleSubmit(onSave)}>
                    Save
                  </Button>
                  <Button
                    fullWidth={false}
                    onClick={(event) => onChangeOpen(event.currentTarget)}
                  >
                    <Icon className="icon-more" />
                  </Button>
                </ButtonGroup>
              )}
            </Dropdown>
          </Box>
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
