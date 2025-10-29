import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
import { useHosts, Dropdown, HostTagsSelect } from 'shared';
import { deleteHost, type Host } from 'tauri-plugin-data';
import { get } from 'lodash-es';

import { useTerminalsAtomWithApi } from '@/atom/terminalsAtom';
import Empty from '@/components/Empty';
import ItemCard from '@/components/ItemCard';
import Page from '@/components/Page';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import useModal from '@/hooks/useModal';
import { useIsShowPaywallAtom, useIsSubscription } from '@/atom/iap';
import useMessage from '@/hooks/useMessage';

import AddHost from './AddHost';

export default function Hosts() {
  const [keyword, setKeyword] = useState('');
  const selectedHostRef = useRef<Host>(null);
  const [isOpenAddHost, setIsOpenAddHost] = useState(false);
  const [editHost, setEditHost] = useState<Host>();
  const navigate = useNavigate();

  const modal = useModal();
  const message = useMessage();

  const { data: hosts, refresh: refreshHosts } = useHosts();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const isSubscription = useIsSubscription();
  const [, setOpen] = useIsShowPaywallAtom();

  const [selectedTag, setSelectedTag] = useState<string>();
  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    let filterHosts = hosts;

    if (selectedTag) {
      filterHosts = filterHosts.filter((item) =>
        item.tags?.includes(selectedTag)
      );
    }

    if (!kw) {
      return filterHosts;
    }
    return filterHosts.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw)
    );
  }, [hosts, keyword, selectedTag]);

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
          setEditHost(selectedHostRef.current || undefined);
          selectedHostRef.current = null;
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
          selectedHostRef.current = null;

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
                message.error({
                  message: get(err, 'message') || 'Deletion failed',
                });
                throw err;
              }
              refreshHosts();
            },
          });
        },
      },
    ],
    [message, modal, refreshHosts, selectedHostRef]
  );

  return (
    <Page
      title="Hosts"
      headerRight={
        <>
          <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
            {({ onChangeOpen }) => {
              return (
                <IconButton
                  sx={(theme) => ({
                    color: 'inherit',
                    [theme.breakpoints.up('sm')]: {
                      display: 'none',
                    },
                  })}
                  edge="end"
                  size="small"
                  onClick={(event) => onChangeOpen(event.currentTarget)}
                >
                  <Icon className="icon-label" />
                </IconButton>
              );
            }}
          </HostTagsSelect>
          <IconButton
            sx={(theme) => ({
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
        </>
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
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
              {({ onChangeOpen, label }) => (
                <List component="nav" dense>
                  <ListItem>
                    <ListItemButton
                      onClick={(event) => onChangeOpen(event.currentTarget)}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Icon className="icon-label" />
                            <Box component="span" sx={{ paddingLeft: 0.5 }}>
                              {label}
                            </Box>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </List>
              )}
            </HostTagsSelect>
            <Button
              variant="contained"
              startIcon={<Icon className="icon-add" />}
              onClick={onAddHostButtonClick}
            >
              Add host
            </Button>
          </Box>
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
