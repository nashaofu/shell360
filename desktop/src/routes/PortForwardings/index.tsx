import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { AddIcon, SearchIcon, useHosts, usePortForwardings } from "shared";
import type { PortForwarding } from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import AddPortForwarding from "@/components/AddPortForwarding";
import Empty from "@/components/Empty";
import panel from "@/styles/panel.module.less";
import PortForwardingItem from "./PortForwardingItem";

export default function PortForwardings() {
  const { data: hosts = [] } = useHosts();
  const { data: portForwardings = [] } = usePortForwardings();

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

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    if (!kw) {
      return portForwardings;
    }

    return portForwardings.filter((item) => {
      const host = hostsMap.get(item.hostId);
      return (
        item.name.toLowerCase().includes(kw) ||
        item.portForwardingType.toLowerCase().includes(kw) ||
        `${item.localAddress}:${item.localPort}`.toLowerCase().includes(kw) ||
        `${item.remoteAddress ?? ""}:${item.remotePort ?? ""}`
          .toLowerCase()
          .includes(kw) ||
        host?.name?.toLowerCase().includes(kw) ||
        host?.hostname.toLowerCase().includes(kw)
      );
    });
  }, [hostsMap, keyword, portForwardings]);

  return (
    <>
      <section className={panel.page}>
        <div className={panel.toolbar}>
          <span className={panel.title}>Port Forwardings</span>
          <label className={panel.search}>
            <SearchIcon className={panel.searchIcon} />
            <input
              className={panel.searchInput}
              value={keyword}
              placeholder="Filter rules..."
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenAddPortForwarding(true)}
          >
            <AddIcon width="11" height="11" />
            New Rule
          </button>
        </div>
        <div className={panel.content}>
          {filteredItems.length ? (
            <div className={panel.tableWrap}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Label</th>
                    <th>Local Port</th>
                    <th>Remote</th>
                    <th>Server</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <PortForwardingItem
                      key={item.id}
                      item={item}
                      hostsMap={hostsMap}
                      onEdit={() => onEdit(item)}
                      onOpenAddKey={() => setAddKeyOpen(true)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty desc="There is no port forwarding yet, add it now.">
              <button
                type="button"
                className={clsx(panel.button, panel.buttonPrimary)}
                onClick={() => setIsOpenAddPortForwarding(true)}
              >
                New Rule
              </button>
            </Empty>
          )}
        </div>
      </section>

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
    </>
  );
}
