import { Button, Callout, IconButton } from "@radix-ui/themes";
import { hasCapability } from "bridge/capabilities";
import type { PortForwarding } from "bridge/data";
import { useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  useHosts,
  usePortForwardings,
  usePortForwardingsAtomWithApi,
} from "shared";
import AddKey from "@/components/AddKey";
import Empty from "@/components/Empty";
import Page from "@/components/Page";
import SearchToolbar from "@/components/SearchToolbar";
import AddPortForwarding from "./AddPortForwarding";
import styles from "./index.module.less";
import PortForwardingItem from "./PortForwardingItem";

export default function PortForwardings() {
  const canStartPortForwarding = hasCapability("portForwarding");
  const { data: hosts } = useHosts();
  const { data: portForwardings } = usePortForwardings();
  const portForwardingsAtomWithApi = usePortForwardingsAtomWithApi();

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

  const { activeItems, inactiveItems } = useMemo(() => {
    const active: PortForwarding[] = [];
    const inactive: PortForwarding[] = [];
    filteredItems.forEach((item) => {
      const atom = portForwardingsAtomWithApi.state.get(item.id);
      if (atom) {
        active.push(item);
      } else {
        inactive.push(item);
      }
    });
    return { activeItems: active, inactiveItems: inactive };
  }, [filteredItems, portForwardingsAtomWithApi.state]);

  const onAddPortForwardingClose = useCallback(() => {
    setIsOpenAddPortForwarding(false);
    setEditItem(undefined);
  }, []);

  const onEdit = useCallback((item: PortForwarding) => {
    setEditItem(item);
    setIsOpenAddPortForwarding(true);
  }, []);

  const renderGroup = (label: string, items: PortForwarding[]) => {
    if (!items.length) return null;
    return (
      <div className={styles.tunnelGroup}>
        <h2 className={styles.tunnelGroupLabel}>{label}</h2>
        {items.map((item) => (
          <PortForwardingItem
            key={item.id}
            item={item}
            hostsMap={hostsMap}
            onEdit={() => onEdit(item)}
            onOpenAddKey={() => setAddKeyOpen(true)}
          />
        ))}
      </div>
    );
  };

  return (
    <Page
      title="Tunnels"
      headerRight={
        <IconButton
          type="button"
          size="3"
          variant="ghost"
          className={styles.headerAction}
          onClick={() => setIsOpenAddPortForwarding(true)}
          aria-label="New Tunnel"
        >
          <AddIcon />
        </IconButton>
      }
    >
      {!canStartPortForwarding && (
        <Callout.Root color="gray" style={{ margin: "12px 0" }}>
          <Callout.Text>
            Tunnels can be configured here, but starting them is not available
            on this platform yet.
          </Callout.Text>
        </Callout.Root>
      )}
      <SearchToolbar
        value={keyword}
        placeholder="Search tunnels"
        onChange={setKeyword}
      />

      {renderGroup("Active", activeItems)}
      {renderGroup("Inactive", inactiveItems)}

      {!filteredItems.length && (
        <Empty
          desc={
            portForwardings.length
              ? "No tunnels match your search."
              : "There is no tunnel yet, add it now."
          }
        >
          <Button
            type="button"
            size="3"
            className={styles.emptyPrimary}
            onClick={() => setIsOpenAddPortForwarding(true)}
          >
            <AddIcon />
            New tunnel
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
