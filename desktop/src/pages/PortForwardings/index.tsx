import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { useHosts, usePortForwardings } from "shared";
import type { PortForwarding } from "tauri-plugin-data";
import AddKey from "@/features/AddKey";
import Empty from "@/shared/ui/Empty";
import panel from "@/shared/styles/panel.module.less";

import AddPortForwarding from "./AddPortForwarding";
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
            <svg
              className={panel.searchIcon}
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="6"
                cy="6"
                r="4"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M9.5 9.5L13 13"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
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
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
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
