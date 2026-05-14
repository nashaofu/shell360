import { Button, Flex, TextField } from "@radix-ui/themes";
import { useCallback, useMemo, useState } from "react";
import { useHosts, usePortForwardings } from "shared";
import type { PortForwarding } from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import AutoRepeatGrid from "@/components/AutoRepeatGrid";
import Empty from "@/components/Empty";
import Page from "@/components/Page";

import AddPortForwarding from "./AddPortForwarding";
import PortForwardingItem from "./PortForwardingItem";

export default function PortForwardings() {
  const { data: hosts } = useHosts();
  const { data: portForwardings } = usePortForwardings();

  const [keyword, setKeyword] = useState("");
  const [isOpenAddPortForwarding, setIsOpenAddPortForwarding] = useState(false);
  const [editItem, setEditItem] = useState<PortForwarding>();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts],
  );

  const onAddPortForwardingClose = useCallback(() => {
    setIsOpenAddPortForwarding(false);
    setEditItem(undefined);
  }, []);

  const onEdit = useCallback((item: PortForwarding) => {
    setEditItem(item);
    setIsOpenAddPortForwarding(true);
  }, []);

  return (
    <Page
      eyebrow="Network"
      title="Port Forwardings"
      description="Create and reuse local, remote, and dynamic forwarding rules alongside the hosts they depend on."
    >
      <Flex align="center" justify="between" my="4" gap="3">
        <TextField.Root
          style={{ flexGrow: 1, maxWidth: 380 }}
          value={keyword}
          placeholder="Search..."
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Button onClick={() => setIsOpenAddPortForwarding(true)}>
          <span className="icon-add" />
          Add
        </Button>
      </Flex>
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
          <Button onClick={() => setIsOpenAddPortForwarding(true)}>
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
