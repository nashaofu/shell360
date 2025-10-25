import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonGroup, Icon } from '@mui/material';
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME,
  useHosts,
} from 'shared';
import {
  AuthenticationMethod,
  Host,
  addHost,
  updateHost,
} from 'tauri-plugin-data';

import { useTerminalsAtomWithApi } from '@/atom/terminalsAtom';
import EditHostForm from '@/components/EditHostForm';
import PageDrawer from '@/components/PageDrawer';
import Dropdown from '@/components/Dropdown';

type AddHostProps = {
  open?: boolean;
  data?: Host;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddHost({ open, data, onOk, onCancel }: AddHostProps) {
  const navigate = useNavigate();
  const { refresh: refreshHosts } = useHosts();

  const formApi = useForm<Omit<Host, 'id'>>({
    defaultValues: {
      name: '',
      hostname: '',
      port: 22,
      username: '',
      authenticationMethod: AuthenticationMethod.Password,
      password: '',
      keyId: '',
      startupCommand: '',
      jumpHostEnabled: false,
      jumpHostIds: [],
      terminalSettings: {
        fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
        fontSize: DEFAULT_TERMINAL_FONT_SIZE,
        theme: DEFAULT_TERMINAL_THEME?.name,
      },
    },
    values: {
      name: data?.name ?? '',
      hostname: data?.hostname ?? '',
      port: data?.port ?? 22,
      username: data?.username ?? '',
      authenticationMethod:
        data?.authenticationMethod ?? AuthenticationMethod.Password,
      password: data?.password ?? '',
      keyId: data?.keyId ?? '',
      startupCommand: data?.startupCommand ?? '',
      jumpHostEnabled: data?.jumpHostIds?.length > 0,
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
    async (values: Omit<Host, 'id'>) => {
      const hostData = {
        name: values.name,
        hostname: values.hostname,
        port: Number(values.port),
        username: values.username,
        authenticationMethod: values.authenticationMethod,
        password:
          values.authenticationMethod === 'Password'
            ? values.password
            : undefined,
        keyId:
          values.authenticationMethod === 'PublicKey' ||
          values.authenticationMethod === 'Certificate'
            ? values.keyId
            : undefined,
        startupCommand: values.startupCommand || undefined,
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
    async (values: Omit<Host, 'id'>) => {
      const savedHost = await save(values);
      await refreshHosts();
      onOk();

      const [item] = terminalsAtomWithApi.add(savedHost);
      navigate(`/terminal/${item.uuid}`, { replace: true });
    },
    [navigate, onOk, save, refreshHosts, terminalsAtomWithApi]
  );

  const onSave = useCallback(
    async (values: Omit<Host, 'id'>) => {
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
      <EditHostForm formApi={formApi} hostId={data?.id} />
    </PageDrawer>
  );
}
