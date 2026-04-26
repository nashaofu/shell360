import { Button, DropdownMenu } from "@radix-ui/themes";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddIcon,
  ContentCopyIcon,
  DeleteIcon,
  EditIcon,
  getHostDesc,
  getHostName,
  HostIcon,
  HostTagsSelect,
  LabelIcon,
  MoreIcon,
  useHosts,
  useTerminalsAtomWithApi,
} from "shared";
import { addHost, deleteHost, type Host } from "tauri-plugin-data";
import { useIsShowPaywallAtom, useIsSubscription } from "@/atoms/iap.atom";
import AutoRepeatGrid from "@/components/AutoRepeatGrid";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";

import AddHost from "./AddHost";

export default function Hosts() {
  const [keyword, setKeyword] = useState("");
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
        item.tags?.includes(selectedTag),
      );
    }

    if (!kw) {
      return filterHosts;
    }
    return filterHosts.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw),
    );
  }, [hosts, keyword, selectedTag]);

  const onOpenChannel = useCallback(
    (host: Host) => {
      const [item] = terminalsAtomWithApi.add(host);
      navigate(`/terminal/${item.uuid}`);
    },
    [navigate, terminalsAtomWithApi],
  );

  const onAddHostButtonClick = useCallback(() => {
    // 没订阅时，最多只能创�?个host
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

  const onCopyHost = useCallback(
    async (host: Host) => {
      if (!isSubscription && hosts.length >= 3) {
        setOpen(true);
        return;
      }

      try {
        const copiedHost = await addHost({
          ...omit(host, ["id"]),
          name: `${getHostName(host)} Copy`,
        });

        await refreshHosts();
        setEditHost(copiedHost);
        setIsOpenAddHost(true);
      } catch (err) {
        message.error({
          message: get(err, "message") || "Copy failed",
        });
      }
    },
    [hosts.length, isSubscription, message, refreshHosts, setOpen],
  );

  const onDeleteHost = useCallback(
    (host: Host) => {
      const hostname = host.name || `${host.hostname}:${host.port}`;

      modal.confirm({
        title: "Delete Confirmation",
        content: `Are you sure to delete the host: ${hostname}?`,
        OkButtonProps: {
          color: "orange",
        },
        onOk: async () => {
          try {
            await deleteHost(host);
          } catch (err) {
            message.error({
              message: get(err, "message") || "Deletion failed",
            });
            throw err;
          }
          refreshHosts();
        },
      });
    },
    [message, modal, refreshHosts],
  );

  return (
    <Page
      title="Hosts"
      headerRight={
        <>
          <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
            {() => {
              return (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <LabelIcon />
                </button>
              );
            }}
          </HostTagsSelect>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 4,
            }}
            onClick={onAddHostButtonClick}
          >
            <AddIcon />
          </button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "16px 0",
        }}
      >
        <div style={{ maxWidth: 600, flexGrow: 1 }}>
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
        <div style={{ marginLeft: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
              {({ label }) => (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "1px solid var(--gray-a6)",
                    borderRadius: "var(--radius-2)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    color: "inherit",
                    height: 36,
                  }}
                >
                  <LabelIcon />
                  {label}
                </button>
              )}
            </HostTagsSelect>
            <Button onClick={onAddHostButtonClick}>
              <AddIcon />
              Add host
            </Button>
          </div>
        </div>
      </div>
      <AutoRepeatGrid
        sx={{
          gap: 2,
        }}
        itemWidth={280}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            icon={<HostIcon />}
            title={getHostName(item)}
            desc={getHostDesc(item)}
            extra={
              <div onClick={(event) => event.stopPropagation()}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "inherit",
                        padding: 4,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <MoreIcon />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenu.Item
                      onSelect={() => {
                        setEditHost(item);
                        setIsOpenAddHost(true);
                      }}
                    >
                      <EditIcon style={{ marginRight: 8 }} />
                      Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => onCopyHost(item)}>
                      <ContentCopyIcon style={{ marginRight: 8 }} />
                      Copy
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => onDeleteHost(item)}>
                      <DeleteIcon style={{ marginRight: 8 }} />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
            }
            onClick={() => onOpenChannel(item)}
          />
        ))}
      </AutoRepeatGrid>

      {!items.length && (
        <Empty desc="There is no host yet, add it now.">
          <Button onClick={() => setIsOpenAddHost(true)}>Add host</Button>
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
