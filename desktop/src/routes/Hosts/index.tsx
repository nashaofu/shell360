import { useCallback, useMemo, useState, useRef } from 'react';
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
import { deleteHost, type Host } from 'tauri-plugin-data';
import { getHostName, useHosts, Dropdown, getDesc } from 'shared';
import { get } from 'lodash-es';

import { copy } from '@/utils/clipboard';
import { useTerminalsAtomWithApi } from '@/atom/terminalsAtom';
import Empty from '@/components/Empty';
import ItemCard from '@/components/ItemCard';
import Page from '@/components/Page';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import useModal from '@/hooks/useModal';
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

  const { data: hosts = [], refresh: refreshHosts } = useHosts();

  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    if (!kw) {
      return hosts;
    }
    return hosts.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw),
    );
  }, [hosts, keyword]);

  const onOpenChannel = useCallback(
    (host: Host) => {
      const [item] = terminalsAtomWithApi.add(host);
      navigate(`/terminal/${item.uuid}`, { replace: true });
    },
    [navigate, terminalsAtomWithApi],
  );

  const onAddHostClose = useCallback(() => {
    setIsOpenAddHost(false);
    setEditHost(undefined);
  }, []);

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
    [modal, refreshHosts, message, selectedHostRef],
  );

  return (
    <Page title="Hosts">
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
          onClick={() => setIsOpenAddHost(true)}
        >
          Add host
        </Button>
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
            remark={item.remark}
            icon={<Icon className="icon-host" />}
            title={getHostName(item)}
            desc={getDesc(item)}
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
                    onClick={(event) => {
                      selectedHostRef.current = item;
                      onChangeOpen(event.currentTarget);
                    }}
                  >
                    <Icon className="icon-more" />
                  </IconButton>
                )}
              </Dropdown>
            }
            onDoubleClick={() => onOpenChannel(item)}
            onClick={() => copy(item.hostname)}
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
