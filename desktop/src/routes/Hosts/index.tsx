import { Button, Flex, IconButton, TextField } from "@radix-ui/themes";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dropdown,
  getHostDesc,
  getHostName,
  HostTagsSelect,
  useHosts,
  useTerminalsAtomWithApi,
} from "shared";
import { addHost, deleteHost, type Host } from "tauri-plugin-data";
import AutoRepeatGrid from "@/components/AutoRepeatGrid";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";

import AddHost from "./AddHost";

export default function Hosts() {
  const [keyword, setKeyword] = useState("");
  const selectedHostRef = useRef<Host>(null);
  const [isOpenAddHost, setIsOpenAddHost] = useState(false);
  const [editHost, setEditHost] = useState<Host>();
  const navigate = useNavigate();

  const modal = useModal();
  const message = useMessage();

  const { data: hosts = [], refresh: refreshHosts } = useHosts();

  const terminalsAtomWithApi = useTerminalsAtomWithApi();

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
      navigate(`/terminal/${item.uuid}`, { replace: true });
    },
    [navigate, terminalsAtomWithApi],
  );

  const onAddHostClose = useCallback(() => {
    setIsOpenAddHost(false);
    setEditHost(undefined);
  }, []);

  const onCopyHost = useCallback(async () => {
    const selectedHost = selectedHostRef.current;
    selectedHostRef.current = null;

    if (!selectedHost) {
      return;
    }

    try {
      const copiedHost = await addHost({
        ...omit(selectedHost, ["id"]),
        name: `${getHostName(selectedHost)} Copy`,
      });

      await refreshHosts();
      setEditHost(copiedHost);
      setIsOpenAddHost(true);
    } catch (err) {
      message.error({
        message: get(err, "message") || "Copy failed",
      });
    }
  }, [message, refreshHosts]);

  const menus = useMemo(
    () => [
      {
        label: (
          <>
            <span className="icon-edit" style={{ marginRight: 8 }} />
            Edit
          </>
        ),
        value: "Edit",
        onClick: () => {
          setIsOpenAddHost(true);
          setEditHost(selectedHostRef.current || undefined);
          selectedHostRef.current = null;
        },
      },
      {
        label: (
          <>
            <span className="icon-content-copy" style={{ marginRight: 8 }} />
            Copy
          </>
        ),
        value: "Copy",
        onClick: onCopyHost,
      },
      {
        label: (
          <>
            <span className="icon-delete" style={{ marginRight: 8 }} />
            Delete
          </>
        ),
        value: "Delete",
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
            title: "Delete Confirmation",
            content: `Are you sure to delete the host: ${hostname}?`,
            OkButtonProps: {
              color: "orange",
            },
            onOk: async () => {
              try {
                await deleteHost(selectedHost);
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
      },
    ],
    [modal, onCopyHost, refreshHosts, message],
  );

  return (
    <Page
      eyebrow="Connections"
      title="Hosts"
      description="Manage saved SSH endpoints, filter by tags, and open new terminal sessions without leaving the workspace."
    >
      <Flex align="center" justify="between" my="4" gap="3">
        <TextField.Root
          style={{ flexGrow: 1, maxWidth: 380 }}
          value={keyword}
          placeholder="Search..."
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Flex align="center" gap="2">
          <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
            {({ onChangeOpen, label }) => (
              <Button
                type="button"
                variant="outline"
                color="gray"
                onClick={(event) => onChangeOpen(event.currentTarget)}
              >
                <span className="icon-label" />
                {label}
              </Button>
            )}
          </HostTagsSelect>
          <Button onClick={() => setIsOpenAddHost(true)}>
            <span className="icon-add" />
            Add host
          </Button>
        </Flex>
      </Flex>
      <AutoRepeatGrid
        sx={{
          gap: 2,
        }}
        itemWidth={280}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            icon={<span className="icon-host" />}
            title={getHostName(item)}
            desc={getHostDesc(item)}
            extra={
              <Dropdown
                menus={menus}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
              >
                {({ onChangeOpen }) => (
                  <IconButton
                    type="button"
                    variant="ghost"
                    color="gray"
                    onClick={(event) => {
                      selectedHostRef.current = item;
                      onChangeOpen(event.currentTarget);
                    }}
                  >
                    <span className="icon-more" />
                  </IconButton>
                )}
              </Dropdown>
            }
            onDoubleClick={() => onOpenChannel(item)}
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
