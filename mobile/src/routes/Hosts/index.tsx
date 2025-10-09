import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Icon,
  IconButton,
  ListItemIcon,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
import { useHosts } from 'shared';
import { deleteHost, Host } from 'tauri-plugin-data';
import { get } from 'lodash-es';

import { useTerminalsAtomWithApi } from '@/atom/terminalsAtom';
import Empty from '@/components/Empty';
import ItemCard from '@/components/ItemCard';
import Page from '@/components/Page';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import Dropdown from '@/components/Dropdown';
import useModal from '@/hooks/useModal';
import { useIsShowPaywallAtom, useIsSubscription } from '@/atom/iap';
import useMessage from '@/hooks/useMessage';

import AddHost from './AddHost';

export default function Hosts() {
  const [keyword, setKeyword] = useState('');
  const selectedHostRef = useRef<Host>();
  const [isOpenAddHost, setIsOpenAddHost] = useState(false);
  const [editHost, setEditHost] = useState<Host>();
  const navigate = useNavigate();

  const modal = useModal();
  const message = useMessage();

  const { data: hosts, refresh: refreshHosts } = useHosts();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const isSubscription = useIsSubscription();
  const [, setOpen] = useIsShowPaywallAtom();

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    if (!kw) {
      return hosts;
    }
    return hosts.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw)
    );
  }, [hosts, keyword]);

  const onOpenChannel = useCallback(
    (host: Host) => {
      const [item] = terminalsAtomWithApi.add(host);
      navigate(`/terminal/${item.uuid}`);
    },
    [navigate, terminalsAtomWithApi]
  );

  const onAddHostButtonClick = useCallback(() => {
    // 没订阅时，最多只能创建1个host
    if (!isSubscription && hosts.length >= 3) {
      setOpen(true);
      return;
    }
    setIsOpenAddHost(true);
  }, [isSubscription, hosts.length, setOpen]);

  const onAddHostClose = useCallback(() => {
    setIsOpenAddHost(false);
    setEditHost(undefined);
    refreshHosts();
  }, [refreshHosts]);

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
          setIsOpenAddHost(true);
          setEditHost(selectedHostRef.current);
          selectedHostRef.current = undefined;
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
          const selectedHost = selectedHostRef.current;
          selectedHostRef.current = undefined;

          if (!selectedHost) {
            return;
          }

          const hostname =
            selectedHost.name ||
            `${selectedHost.hostname}:${selectedHost.port}`;

          modal.confirm({
            title: 'Delete Confirmation',
            content: `Are you sure to delete the host: ${hostname}?`,
            OkButtonProps: {
              color: 'warning',
            },
            onOk: async () => {
              try {
                await deleteHost(selectedHost);
              } catch (err) {
                if (get(err, 'type') === 'DeleteForeignKeyError') {
                  message.error({
                    message:
                      'Deletion failed, other items are still using the current host',
                  });
                }
                throw err;
              }
              refreshHosts();
            },
          });
        },
      },
    ],
    [message, modal, refreshHosts]
  );

  return (
    <Page
      title="Hosts"
      headerRight={
        <IconButton
          sx={(theme) => ({
            ml: 2,
            color: 'inherit',
            [theme.breakpoints.up('sm')]: {
              display: 'none',
            },
          })}
          edge="end"
          size="small"
          onClick={onAddHostButtonClick}
        >
          <Icon className="icon-add" />
        </IconButton>
      }
    >
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
            maxWidth: 600,
            flexGrow: 1,
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
        <Box
          sx={(theme) => ({
            ml: 2,
            [theme.breakpoints.down('sm')]: {
              display: 'none',
            },
          })}
        >
          <Button
            variant="contained"
            startIcon={<Icon className="icon-add" />}
            onClick={onAddHostButtonClick}
          >
            Add host
          </Button>
        </Box>
      </Box>
      <AutoRepeatGrid
        sx={{
          gap: 2,
        }}
        itemWidth={280}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            icon={<Icon className="icon-host" />}
            title={item.name || `${item.hostname}:${item.port}`}
            desc={item.username}
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
                        selectedHostRef.current = item;
                        onChangeOpen(event.currentTarget);
                      }}
                    >
                      <Icon className="icon-more" />
                    </IconButton>
                  )}
                </Dropdown>
              </Box>
            }
            onClick={() => onOpenChannel(item)}
          />
        ))}
      </AutoRepeatGrid>

      {!items.length && (
        <Empty desc="There is no host yet, add it now.">
          <Button variant="contained" onClick={() => setIsOpenAddHost(true)}>
            Add host
          </Button>
        </Empty>
      )}

      <AddHost
        open={isOpenAddHost}
        data={editHost}
        onOk={onAddHostClose}
        onCancel={onAddHostClose}
      />
    </Page>
  );
}
