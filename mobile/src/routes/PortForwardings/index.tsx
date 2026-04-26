import { Button } from "@radix-ui/themes";
import { useCallback, useMemo, useState } from "react";
import { AddIcon, useHosts, usePortForwardings } from "shared";
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

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) {
      return portForwardings;
    }

    return portForwardings.filter((item) => {
      const host = hostsMap.get(item.hostId);
      return [
        item.name,
        item.portForwardingType,
        `${item.localAddress}:${item.localPort}`,
        `${item.remoteAddress ?? ""}:${item.remotePort ?? ""}`,
        host?.name,
        host?.hostname,
      ].some((value) => value?.toLowerCase().includes(kw));
    });
  }, [hostsMap, keyword, portForwardings]);

  const onAddPortForwardingClose = useCallback(() => {
    setIsOpenAddPortForwarding(false);
    setEditItem(undefined);
  }, []);

  const onEdit = useCallback((item: PortForwarding) => {
    setEditItem(item);
    setIsOpenAddPortForwarding(true);
  }, []);

  return (
    <Page title="Tunnels">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "16px 0",
        }}
      >
        <div style={{ flexGrow: 1, maxWidth: 380, marginRight: 16 }}>
          <input
            className="rt-reset rt-TextFieldInput"
            value={keyword}
            style={{
              width: "100%",
              paddingLeft: 8,
              paddingRight: 8,
              height: 36,
            }}
            placeholder="Search..."
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Button onClick={() => setIsOpenAddPortForwarding(true)}>
          <AddIcon />
          Add
        </Button>
      </div>
      <AutoRepeatGrid
        sx={{
          gap: 2,
          mt: 2,
        }}
        itemWidth={360}
      >
        {filteredItems.map((item) => (
          <PortForwardingItem
            key={item.id}
            item={item}
            hostsMap={hostsMap}
            onEdit={() => onEdit(item)}
            onOpenAddKey={() => setAddKeyOpen(true)}
          />
        ))}
      </AutoRepeatGrid>
      {!filteredItems.length && (
        <Empty
          desc={
            portForwardings.length
              ? "No tunnels match your search."
              : "There is no tunnel yet, add it now."
          }
        >
          <Button onClick={() => setIsOpenAddPortForwarding(true)}>
            Add tunnel
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
