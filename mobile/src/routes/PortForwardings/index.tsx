import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Icon, OutlinedInput } from '@mui/material';
import { useHosts, usePortForwardings } from 'shared';
import { type PortForwarding } from 'tauri-plugin-data';

import Empty from '@/components/Empty';
import Page from '@/components/Page';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import AddKey from '@/components/AddKey';

import AddPortForwarding from './AddPortForwarding';
import PortForwardingItem from './PortForwardingItem';

export default function PortForwardings() {
  const { data: hosts } = useHosts();
  const { data: portForwardings } = usePortForwardings();

  const [keyword, setKeyword] = useState('');
  const [isOpenAddPortForwarding, setIsOpenAddPortForwarding] = useState(false);
  const [editItem, setEditItem] = useState<PortForwarding>();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts]
  );

  const onAddPortForwardingClose = useCallback(() => {
    setIsOpenAddPortForwarding(false);
    setEditItem(undefined);
  }, []);

  const onEdit = useCallback(
    (item: PortForwarding) => {
      setEditItem(item);
      setIsOpenAddPortForwarding(true);
      setIsOpenAddPortForwarding(true);
    },
    [setEditItem, setIsOpenAddPortForwarding]
  );

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
          <PortForwardingItem
            key={item.id}
            item={item}
            hostsMap={hostsMap}
            onEdit={() => onEdit(item)}
            onOpenAddKey={() => setAddKeyOpen(true)}
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
      />

      <AddKey
        open={addKeyOpen}
        onCancel={() => setAddKeyOpen(false)}
        onOk={() => setAddKeyOpen(false)}
      />
    </Page>
  );
}
