import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { useMemoizedFn } from 'ahooks';
import {
  usePortForwardings,
  Dropdown,
  SSHLoading,
  establishJumpHostChainConnections,
  usePortForwardingsAtomWithApi,
  type PortForwardingsAtom,
  useKeys,
  getPortForwardingDesc,
  tearDownJumpHostChainConnections,
  PortForwardingLoading,
} from 'shared';
import {
  deletePortForwarding,
  type Host,
  type PortForwarding,
  PortForwardingType,
} from 'tauri-plugin-data';
import { useCallback, useMemo } from 'react';
import {
  Dialog,
  Icon,
  IconButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';

import useModal from '@/hooks/useModal';
import ItemCard from '@/components/ItemCard';

const PORT_FORWARDING_STATUS = {
  pending: '(Loading)',
  failed: '(Failed)',
  success: '(Activated)',
};

type PortForwardingItemProps = {
  item: PortForwarding;
  hostsMap: Map<string, Host>;
  onEdit: () => void;
  onOpenAddKey: () => void;
};

export default function PortForwardingItem({
  item,
  hostsMap,
  onEdit,
  onOpenAddKey,
}: PortForwardingItemProps) {
  const { refresh: refreshPortForwardings } = usePortForwardings();
  const portForwardingsAtomWithApi = usePortForwardingsAtomWithApi();
  const { data: keys } = useKeys();
  const modal = useModal();

  const title = useMemo(() => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingAtom) {
      return item.name;
    }
    return item.name + PORT_FORWARDING_STATUS[portForwardingAtom.status];
  }, [portForwardingsAtomWithApi.state, item.id, item.name]);

  const isLoading = useMemo(() => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingAtom) {
      return false;
    }
    return (
      portForwardingAtom.jumpHostChain.some(
        (item) => item.status !== 'authenticated'
      ) || portForwardingAtom.status !== 'success'
    );
  }, [portForwardingsAtomWithApi, item.id]);

  const currentJumpHostChainItem = useMemo(() => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    return portForwardingAtom?.jumpHostChain?.find(
      (item) => item.status !== 'authenticated'
    );
  }, [portForwardingsAtomWithApi, item.id]);

  const closePortForwarding = useCallback(
    async (portForwardingsAtom: PortForwardingsAtom) => {
      const portForwarding = portForwardingsAtom.portForwarding;
      const sshPortForwarding = portForwardingsAtom.sshPortForwarding;
      if (portForwarding.portForwardingType === PortForwardingType.Local) {
        await sshPortForwarding.closeLocalPortForwarding();
      } else if (
        portForwarding.portForwardingType === PortForwardingType.Remote
      ) {
        await sshPortForwarding.closeRemotePortForwarding();
      } else if (
        portForwarding.portForwardingType === PortForwardingType.Dynamic
      ) {
        await sshPortForwarding.closeDynamicPortForwarding();
      }
    },
    []
  );

  const establishPortForwarding = useCallback(
    async (portForwardingsAtom: PortForwardingsAtom) => {
      portForwardingsAtomWithApi.update({
        ...portForwardingsAtom,
        status: 'pending',
      });
      await establishJumpHostChainConnections(
        portForwardingsAtom.jumpHostChain,
        {
          keysMap: new Map(keys.map((key) => [key.id, key])),
          onJumpHostChainItemUpdate: (jumpHostChainItem) => {
            portForwardingsAtomWithApi.update({
              ...portForwardingsAtom,
              jumpHostChain: portForwardingsAtom.jumpHostChain.map((item) =>
                item.host.id === jumpHostChainItem.host.id
                  ? jumpHostChainItem
                  : item
              ),
            });
          },
        }
      );
      try {
        const portForwarding = portForwardingsAtom.portForwarding;
        const sshPortForwarding = portForwardingsAtom.sshPortForwarding;
        if (portForwarding.portForwardingType === PortForwardingType.Local) {
          await sshPortForwarding.openLocalPortForwarding({
            localAddress: portForwarding.localAddress,
            localPort: portForwarding.localPort,
            remoteAddress: portForwarding.remoteAddress as string,
            remotePort: portForwarding.remotePort as number,
          });
        } else if (
          portForwarding.portForwardingType === PortForwardingType.Remote
        ) {
          await sshPortForwarding.openRemotePortForwarding({
            localAddress: portForwarding.localAddress,
            localPort: portForwarding.localPort,
            remoteAddress: portForwarding.remoteAddress as string,
            remotePort: portForwarding.remotePort as number,
          });
        } else if (
          portForwarding.portForwardingType === PortForwardingType.Dynamic
        ) {
          await sshPortForwarding.openDynamicPortForwarding({
            localAddress: portForwarding.localAddress,
            localPort: portForwarding.localPort,
          });
        }
        portForwardingsAtomWithApi.update({
          ...portForwardingsAtom,
          status: 'success',
        });
      } catch (error) {
        portForwardingsAtomWithApi.update({
          ...portForwardingsAtom,
          status: 'failed',
          error,
        });
        await closePortForwarding(portForwardingsAtom);
      }
    },
    [closePortForwarding, keys, portForwardingsAtomWithApi]
  );

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
        onClick: () => onEdit(),
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
          modal.confirm({
            title: 'Delete Confirmation',
            content: `Are you sure to delete the port forwarding: ${item.name}?`,
            OkButtonProps: {
              color: 'warning',
            },
            onOk: async () => {
              await deletePortForwarding(item);
              refreshPortForwardings();
            },
          });
        },
      },
    ],
    [item, modal, onEdit, refreshPortForwardings]
  );

  const onOpenOrClosePortForwarding = useCallback(async () => {
    const portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (portForwardingsAtom) {
      await closePortForwarding(portForwardingsAtom);
      tearDownJumpHostChainConnections(portForwardingsAtom.jumpHostChain);
      portForwardingsAtomWithApi.delete(portForwardingsAtom.portForwarding.id);
      return;
    }

    const [added] = portForwardingsAtomWithApi.add(item);
    await establishPortForwarding(added);
  }, [
    closePortForwarding,
    establishPortForwarding,
    item,
    portForwardingsAtomWithApi,
  ]);

  const onReConnect = useMemoizedFn(
    (checkServerKey?: SSHSessionCheckServerKey) => {
      let portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
      if (!portForwardingsAtom) {
        return;
      }

      portForwardingsAtom = {
        ...portForwardingsAtom,
        jumpHostChain: portForwardingsAtom.jumpHostChain.map((item) => ({
          ...item,
          checkServerKey,
        })),
      };
      portForwardingsAtomWithApi.update(portForwardingsAtom);

      establishPortForwarding(portForwardingsAtom);
    }
  );

  const onReAuth = useMemoizedFn((hostData) => {
    let portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingsAtom) {
      return;
    }

    portForwardingsAtom = {
      ...portForwardingsAtom,
      jumpHostChain: portForwardingsAtom.jumpHostChain.map((item) => ({
        ...item,
        host: hostData,
      })),
    };
    portForwardingsAtomWithApi.update(portForwardingsAtom);

    establishPortForwarding(portForwardingsAtom);
  });

  const onRetry = useMemoizedFn(() => {
    const portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingsAtom) {
      return;
    }
    establishPortForwarding(portForwardingsAtom);
  });

  const onClose = useCallback(async () => {
    const portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingsAtom) {
      return;
    }
    closePortForwarding(portForwardingsAtom);
    tearDownJumpHostChainConnections(portForwardingsAtom.jumpHostChain);
    portForwardingsAtomWithApi.delete(item.id);
  }, [closePortForwarding, item.id, portForwardingsAtomWithApi]);

  return (
    <>
      <ItemCard
        key={item.id}
        icon={item.portForwardingType[0].toUpperCase()}
        title={title}
        desc={getPortForwardingDesc(item, hostsMap)}
        extra={
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
                onClick={(event) => onChangeOpen(event.currentTarget)}
              >
                <Icon className="icon-more" />
              </IconButton>
            )}
          </Dropdown>
        }
        onDoubleClick={() => onOpenOrClosePortForwarding()}
      />
      <Dialog
        open={isLoading}
        sx={{
          zIndex: 100,
        }}
      >
        {currentJumpHostChainItem ? (
          <SSHLoading
            host={currentJumpHostChainItem.host}
            error={currentJumpHostChainItem?.error}
            onReConnect={onReConnect}
            onReAuth={onReAuth}
            onRetry={onRetry}
            onClose={onClose}
            onOpenAddKey={onOpenAddKey}
          />
        ) : (
          <PortForwardingLoading
            portForwarding={item}
            error={portForwardingsAtomWithApi.state.get(item.id)?.error}
            onClose={onClose}
            onRetry={onRetry}
          />
        )}
      </Dialog>
    </>
  );
}
