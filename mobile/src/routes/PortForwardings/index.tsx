import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Icon,
  IconButton,
  ListItemIcon,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
import {
  SSHSessionCheckServerKey,
  SSHPortForwarding,
  SSHSession,
} from 'tauri-plugin-ssh';
import { useRequest } from 'ahooks';
import { useHosts, useKeys, usePortForwardings } from 'shared';
import {
  deletePortForwarding,
  Host,
  PortForwarding,
  PortForwardingType,
} from 'tauri-plugin-data';

import Empty from '@/components/Empty';
import Page from '@/components/Page';
import ItemCard from '@/components/ItemCard';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import useModal from '@/hooks/useModal';
import Dropdown from '@/components/Dropdown';
import {
  OpenedForwarding,
  OpenedForwardingStatus,
  useOpenedForwardingAtomWithApi,
} from '@/atom/openedForwarding';
import SSHLoading from '@/components/SSHLoading';

import AddPortForwarding from './AddPortForwarding';

function getDesc(
  item: PortForwarding,
  hostsMap: Map<string | undefined, Host>
) {
  const host = hostsMap.get(item.hostId);
  if (item.portForwardingType === PortForwardingType.Local) {
    return `Local ${item.localAddress}:${item.localPort} => ${host?.hostname}:${host?.port} => remote ${item.remoteAddress}:${item.remotePort}`;
  }

  if (item.portForwardingType === PortForwardingType.Remote) {
    return `Remote ${item.remoteAddress}:${item.remotePort} => ${host?.hostname}:${host?.port}  => local ${item.localAddress}:${item.localPort}`;
  }

  if (item.portForwardingType === PortForwardingType.Dynamic) {
    return `Local proxy ${item.localAddress}:${item.localPort} => ${host?.hostname}:${host?.port}  => any address`;
  }
}

const OPENED_FORWARDING_STATUS = {
  [OpenedForwardingStatus.Pending]: '(Loading)',
  [OpenedForwardingStatus.Fail]: '(Fail)',
  [OpenedForwardingStatus.Success]: '(Activated)',
};

export default function PortForwardings() {
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();
  const { data: portForwardings, refresh: refreshPortForwardings } =
    usePortForwardings();

  const [keyword, setKeyword] = useState('');
  const [isOpenAddPortForwarding, setIsOpenAddPortForwarding] = useState(false);
  const selectedPortForwardingRef = useRef<PortForwarding>(null);
  const [editItem, setEditItem] = useState<PortForwarding>();
  const modal = useModal();
  const openedForwardingWithApi = useOpenedForwardingAtomWithApi();
  const openedForwardingMap = useMemo(() => {
    return openedForwardingWithApi.state.reduce((map, item) => {
      map.set(item.portForwarding.id, item);
      return map;
    }, new Map<string, OpenedForwarding>());
  }, [openedForwardingWithApi.state]);

  const hostsMap = useMemo(() => {
    return hosts.reduce((map, item) => {
      map.set(item.id, item);
      return map;
    }, new Map<string | undefined, Host>());
  }, [hosts]);

  const currentConnectingForwarding = useMemo(() => {
    return openedForwardingWithApi.state.find(
      (item) => item.status !== OpenedForwardingStatus.Success
    );
  }, [openedForwardingWithApi.state]);

  const onAddPortForwardingClose = useCallback(() => {
    setIsOpenAddPortForwarding(false);
    setEditItem(undefined);
  }, []);

  const currentConnectingForwardingHost = useMemo(() => {
    return hostsMap.get(currentConnectingForwarding?.portForwarding?.hostId);
  }, [currentConnectingForwarding, hostsMap]);

  const menus = useMemo(
    () => [
      {
        label: (
          <>
            <ListItemIcon>
              <Icon className="icon-edit" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </>
        ),
        value: 'Edit',
        onClick: () => {
          setIsOpenAddPortForwarding(true);
          setEditItem(selectedPortForwardingRef.current || undefined);
          selectedPortForwardingRef.current = null;
        },
      },
      {
        label: (
          <>
            <ListItemIcon>
              <Icon className="icon-delete" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </>
        ),
        value: 'Delete',
        onClick: () => {
          const selected = selectedPortForwardingRef.current;
          selectedPortForwardingRef.current = null;

          if (!selected) {
            return;
          }
          const deleteItemName = selected.name;

          modal.confirm({
            title: 'Delete Confirmation',
            content: `Are you sure to delete the port forwarding: ${deleteItemName}?`,
            OkButtonProps: {
              color: 'warning',
            },
            onOk: async () => {
              await deletePortForwarding(selected);
              refreshPortForwardings();
            },
          });
        },
      },
    ],
    [modal, refreshPortForwardings]
  );

  const closePortForwarding = useCallback(
    async (openedForwarding: OpenedForwarding, dispose?: boolean) => {
      const item = openedForwarding.portForwarding;
      const ssh = openedForwarding.ssh;
      try {
        if (item.portForwardingType === PortForwardingType.Local) {
          await ssh.closeLocalPortForwarding();
        } else if (item.portForwardingType === PortForwardingType.Remote) {
          await ssh.closeRemotePortForwarding();
        } else if (item.portForwardingType === PortForwardingType.Dynamic) {
          await ssh.closeDynamicPortForwarding();
        }
      } finally {
        if (dispose) {
          await ssh.session.disconnect();
        }
      }
    },
    []
  );

  const { run: connect, refresh } = useRequest(
    async (
      opened: OpenedForwarding,
      checkServerKey?: SSHSessionCheckServerKey
    ) => {
      const portForwarding = opened.portForwarding;
      const ssh = opened.ssh;
      const host = hosts.find((item) => item.id === portForwarding.hostId);

      if (!host) {
        throw new Error('The SSH host configuration does not exist.');
      }

      const key = keys.find((item) => item.id === host.keyId);

      await ssh.session.connect(
        {
          hostname: host.hostname,
          port: host.port,
        },
        checkServerKey
      );

      await ssh.session.authenticate({
        username: host.username,
        password: host.password,
        privateKey: key?.privateKey,
        passphrase: key?.passphrase,
      });

      if (portForwarding.portForwardingType === PortForwardingType.Local) {
        await ssh.openLocalPortForwarding({
          localAddress: portForwarding.localAddress,
          localPort: portForwarding.localPort,
          remoteAddress: portForwarding.remoteAddress as string,
          remotePort: portForwarding.remotePort as number,
        });
      } else if (
        portForwarding.portForwardingType === PortForwardingType.Remote
      ) {
        await ssh.openRemotePortForwarding({
          localAddress: portForwarding.localAddress,
          localPort: portForwarding.localPort,
          remoteAddress: portForwarding.remoteAddress as string,
          remotePort: portForwarding.remotePort as number,
        });
      } else if (
        portForwarding.portForwardingType === PortForwardingType.Dynamic
      ) {
        await ssh.openDynamicPortForwarding({
          localAddress: portForwarding.localAddress,
          localPort: portForwarding.localPort,
        });
      }
    },
    {
      manual: true,
      onSuccess: (_, [opened]) => {
        openedForwardingWithApi.update({
          ...opened,
          status: OpenedForwardingStatus.Success,
        });
      },
      onError: (error, [opened]) => {
        openedForwardingWithApi.update({
          ...opened,
          status: OpenedForwardingStatus.Fail,
          error,
        });
        closePortForwarding(opened);
      },
    }
  );

  const onOpenPortForwarding = useCallback(
    async (item: PortForwarding) => {
      const opened = openedForwardingMap.get(item.id);
      if (opened) {
        openedForwardingWithApi.delete(opened.uuid);
        await closePortForwarding(opened, true);
        return;
      }

      const session = new SSHSession({});
      const ssh = new SSHPortForwarding({ session });
      const [added] = openedForwardingWithApi.add(item, ssh);
      connect(added);
    },
    [closePortForwarding, connect, openedForwardingMap, openedForwardingWithApi]
  );

  const onClose = useCallback(() => {
    if (!currentConnectingForwarding) {
      return;
    }
    openedForwardingWithApi.delete(currentConnectingForwarding.uuid);
    closePortForwarding(currentConnectingForwarding);
  }, [
    closePortForwarding,
    currentConnectingForwarding,
    openedForwardingWithApi,
  ]);

  return (
    <Page title="Port forwardings">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          my: 2,
        }}
      >
        <Box
          sx={{
            flexGrow: 1,
            maxWidth: 380,
            mr: 2,
          }}
        >
          <OutlinedInput
            value={keyword}
            fullWidth
            size="small"
            startAdornment={<Icon className="icon-search" />}
            placeholder="Search..."
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Box>
        <Button
          variant="contained"
          sx={{
            height: 40,
          }}
          startIcon={<Icon className="icon-add" />}
          onClick={() => setIsOpenAddPortForwarding(true)}
        >
          Add
        </Button>
      </Box>
      <AutoRepeatGrid
        sx={{
          gap: 2,
          mt: 2,
        }}
        itemWidth={360}
      >
        {portForwardings.map((item) => (
          <ItemCard
            key={item.id}
            icon={item.portForwardingType[0].toUpperCase()}
            title={
              item.name +
              (OPENED_FORWARDING_STATUS[
                openedForwardingMap.get(item.id)
                  ?.status as OpenedForwardingStatus
              ] || '')
            }
            desc={getDesc(item, hostsMap)}
            extra={
              <Box onClick={(event) => event.stopPropagation()}>
                <Dropdown
                  menus={menus}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  {({ onChangeOpen }) => (
                    <IconButton
                      onClick={(event) => {
                        selectedPortForwardingRef.current = item;
                        onChangeOpen(event.currentTarget);
                      }}
                    >
                      <Icon className="icon-more" />
                    </IconButton>
                  )}
                </Dropdown>
              </Box>
            }
            onClick={() => onOpenPortForwarding(item)}
          />
        ))}
      </AutoRepeatGrid>
      {!portForwardings.length && (
        <Empty desc="There is no port forwarding yet, add it now.">
          <Button
            variant="contained"
            onClick={() => setIsOpenAddPortForwarding(true)}
          >
            Add port forwarding
          </Button>
        </Empty>
      )}

      <AddPortForwarding
        open={isOpenAddPortForwarding}
        data={editItem}
        onOk={onAddPortForwardingClose}
        onCancel={onAddPortForwardingClose}
      ></AddPortForwarding>

      <Dialog
        open={!!currentConnectingForwarding}
        sx={{
          '.MuiDialog-container': {
            paddingTop: 'env(safe-area-inset-top)',
          },
        }}
      >
        {currentConnectingForwarding && currentConnectingForwardingHost && (
          <SSHLoading
            host={currentConnectingForwardingHost}
            loading={
              currentConnectingForwarding?.status ===
              OpenedForwardingStatus.Pending
            }
            error={currentConnectingForwarding?.error as Error}
            onRefresh={refresh}
            onRun={(checkServerKey?: SSHSessionCheckServerKey) =>
              connect(currentConnectingForwarding, checkServerKey)
            }
            onClose={onClose}
          ></SSHLoading>
        )}
      </Dialog>
    </Page>
  );
}
