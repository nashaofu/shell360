import { Button, DropdownMenu, IconButton } from "@radix-ui/themes";
import { addHost, deleteHost, type Host } from "bridge/data";
import { get, omit } from "lodash-es";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  ArrowDownIcon,
  ContentCopyIcon,
  DeleteIcon,
  EditIcon,
  getHostName,
  HostIcon,
  HostTagsSelect,
  LabelIcon,
  MoreIcon,
  useHosts,
  useTerminalsAtomValue,
  useTerminalsAtomWithApi,
} from "shared";
import Empty from "@/components/Empty";
import type { ConnectionErrorInfo } from "@/components/HostCard";
import HostCard from "@/components/HostCard";
import Page from "@/components/Page";
import SearchToolbar from "@/components/SearchToolbar";
import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import styles from "./index.module.less";

import AddHost from "./AddHost";

export default function Hosts() {
  const [keyword, setKeyword] = useState("");
  const [isOpenAddHost, setIsOpenAddHost] = useState(false);
  const [editHost, setEditHost] = useState<Host>();
  const [selectedTag, setSelectedTag] = useState<string>();
  const activateTerminal = useActivateTerminal();

  const modal = useModal();
  const message = useMessage();

  const { data: hosts, refresh: refreshHosts } = useHosts();
  const terminals = useTerminalsAtomValue();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const hostTerminalStates = useMemo(() => {
    const map = new Map<
      string,
      {
        ssh: { pending: boolean; error?: string; terminalId?: string };
        sftp: { pending: boolean; error?: string; terminalId?: string };
      }
    >();
    for (const [uuid, term] of terminals) {
      const state = map.get(term.host.id) ?? {
        ssh: { pending: false },
        sftp: { pending: false },
      };
      if (term.type === "sftp") {
        state.sftp.pending = term.status === "pending";
        state.sftp.terminalId = uuid;
        if (term.status === "failed") {
          state.sftp.error =
            (term.error as { message?: string })?.message ??
            "Connection failed";
        }
      } else {
        state.ssh.pending = term.status === "pending";
        state.ssh.terminalId = uuid;
        if (term.status === "failed") {
          state.ssh.error =
            (term.error as { message?: string })?.message ??
            "Connection failed";
        }
      }
      map.set(term.host.id, state);
    }
    return map;
  }, [terminals]);

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
        item.username?.toLowerCase().includes(kw) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(kw)) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw),
    );
  }, [hosts, keyword, selectedTag]);

  const onOpenConnection = useCallback(
    (host: Host, type: "terminal" | "sftp") => {
      const [item] =
        type === "sftp"
          ? terminalsAtomWithApi.addSftp(host)
          : terminalsAtomWithApi.add(host);
      activateTerminal(item.uuid);
    },
    [activateTerminal, terminalsAtomWithApi],
  );

  const onRetryConnection = useCallback(
    (host: Host, type: "terminal" | "sftp", terminalId: string | undefined) => {
      if (terminalId) {
        terminalsAtomWithApi.delete(terminalId);
      }
      onOpenConnection(host, type);
    },
    [onOpenConnection, terminalsAtomWithApi],
  );

  const onAddHostButtonClick = useCallback(() => {
    setIsOpenAddHost(true);
  }, []);

  const onAddHostClose = useCallback(() => {
    setIsOpenAddHost(false);
    setEditHost(undefined);
    refreshHosts();
  }, [refreshHosts]);

  const onEditHost = useCallback((host: Host) => {
    setEditHost(host);
    setIsOpenAddHost(true);
  }, []);

  const onCopyHost = useCallback(
    async (host: Host) => {
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
    [message, refreshHosts],
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

  const moreActions = useCallback(
    (host: Host): ReactNode => {
      return (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button
              type="button"
              aria-label={`More actions for ${getHostName(host)}`}
            >
              <MoreIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
            <DropdownMenu.Item onSelect={() => onEditHost(host)}>
              <EditIcon style={{ marginRight: 8 }} />
              Edit
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => onCopyHost(host)}>
              <ContentCopyIcon style={{ marginRight: 8 }} />
              Duplicate
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => onDeleteHost(host)}>
              <DeleteIcon style={{ marginRight: 8 }} />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    },
    [onCopyHost, onDeleteHost, onEditHost],
  );

  const buildError = (
    errorMsg: string | undefined,
    onRetry: () => void,
  ): ConnectionErrorInfo | undefined => {
    if (!errorMsg) return undefined;
    return { message: errorMsg, onRetry };
  };

  return (
    <Page
      title="Hosts"
      headerRight={
        <IconButton
          type="button"
          size="3"
          variant="ghost"
          className={styles.headerAction}
          onClick={onAddHostButtonClick}
          aria-label="New Host"
        >
          <AddIcon />
        </IconButton>
      }
    >
      <SearchToolbar
        value={keyword}
        placeholder="Search hosts"
        onChange={setKeyword}
        activeFilterCount={selectedTag ? 1 : 0}
        filterTrigger={
          <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
            {({ label }) => (
              <Button
                type="button"
                size="2"
                variant={selectedTag ? "soft" : "surface"}
                className={styles.filterTrigger}
              >
                <LabelIcon aria-hidden="true" />
                {label}
                <ArrowDownIcon aria-hidden="true" />
              </Button>
            )}
          </HostTagsSelect>
        }
      />

      {items.map((item) => {
        const states = hostTerminalStates.get(item.id);
        return (
          <div className={styles.listItem} key={item.id}>
            <HostCard
              host={item}
              onOpenSsh={() => onOpenConnection(item, "terminal")}
              onOpenSftp={() => onOpenConnection(item, "sftp")}
              onOpenDetails={() => onEditHost(item)}
              actions={moreActions(item)}
              sshPending={states?.ssh.pending}
              sftpPending={states?.sftp.pending}
              sshError={buildError(states?.ssh.error, () =>
                onRetryConnection(item, "terminal", states?.ssh.terminalId),
              )}
              sftpError={buildError(states?.sftp.error, () =>
                onRetryConnection(item, "sftp", states?.sftp.terminalId),
              )}
            />
          </div>
        );
      })}

      {!hosts.length && (
        <Empty desc="There is no host yet, add it now.">
          <Button
            type="button"
            size="3"
            className={styles.emptyPrimary}
            onClick={onAddHostButtonClick}
          >
            <AddIcon />
            New Host
          </Button>
        </Empty>
      )}

      {!!hosts.length && !items.length && (
        <Empty desc="No hosts match your search." icon={<HostIcon />}>
          <Button
            type="button"
            size="3"
            variant="soft"
            color="gray"
            className={styles.emptySecondary}
            onClick={() => {
              setKeyword("");
              setSelectedTag(undefined);
            }}
          >
            Clear search
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
