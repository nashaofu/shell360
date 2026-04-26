import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { AddIcon, useHosts, usePortForwardings } from "shared";
import type { PortForwarding } from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import AddPortForwarding from "@/components/AddPortForwarding";
import Empty from "@/components/Empty";
import ListToolbar from "@/components/ListToolbar";
import { useListView } from "@/hooks/useListView";
import panel from "@/styles/panel.module.less";
import { filterByKeyword } from "@/utils/list";
import styles from "./index.module.less";
import PortForwardingItem from "./PortForwardingItem";
import { usePortForwardingRuntime } from "./usePortForwardingRuntime";

export default function PortForwardings() {
  const { data: hosts = [] } = useHosts();
  const { data: portForwardings = [] } = usePortForwardings();

  const { keyword, setKeyword, viewMode, setViewMode } = useListView();
  const [isOpenAddPortForwarding, setIsOpenAddPortForwarding] = useState(false);
  const [editItem, setEditItem] = useState<PortForwarding>();
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const getPortForwardingRuntime = usePortForwardingRuntime();

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
    return filterByKeyword(portForwardings, keyword, [
      (item) => item.name,
      (item) => item.portForwardingType,
      (item) => `${item.localAddress}:${item.localPort}`,
      (item) => `${item.remoteAddress ?? ""}:${item.remotePort ?? ""}`,
      (item) => {
        const host = hostsMap.get(item.hostId);
        return host?.name;
      },
      (item) => {
        const host = hostsMap.get(item.hostId);
        return host?.hostname;
      },
    ]);
  }, [hostsMap, keyword, portForwardings]);

  return (
    <>
      <section className={panel.page}>
        <ListToolbar
          title="Tunnels"
          keyword={keyword}
          onKeywordChange={setKeyword}
          searchPlaceholder="Filter tunnels..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        >
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenAddPortForwarding(true)}
          >
            <AddIcon width="11" height="11" />
            New Tunnel
          </button>
        </ListToolbar>
        <div className={panel.content}>
          {filteredItems.length && viewMode === "list" ? (
            <div className={panel.tableWrap}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Name</th>
                    <th>Type</th>
                    <th>Local Address</th>
                    <th>Local Port</th>
                    <th>Remote Address</th>
                    <th>Remote Port</th>
                    <th>Host</th>
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
                      runtime={getPortForwardingRuntime(item)}
                      viewMode="list"
                      onEdit={() => onEdit(item)}
                      onOpenAddKey={() => setAddKeyOpen(true)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredItems.length ? (
            <div className={styles.grid}>
              {filteredItems.map((item) => (
                <PortForwardingItem
                  key={item.id}
                  item={item}
                  hostsMap={hostsMap}
                  runtime={getPortForwardingRuntime(item)}
                  viewMode="grid"
                  onEdit={() => onEdit(item)}
                  onOpenAddKey={() => setAddKeyOpen(true)}
                />
              ))}
            </div>
          ) : (
            <Empty desc="There is no tunnel yet, add it now.">
              <button
                type="button"
                className={clsx(panel.button, panel.buttonPrimary)}
                onClick={() => setIsOpenAddPortForwarding(true)}
              >
                New Tunnel
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
