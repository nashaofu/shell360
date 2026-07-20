import { Badge, Button, Flex, IconButton } from "@radix-ui/themes";
import { addHost, deleteHost, type Host } from "bridge/data";
import clsx from "clsx";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  FilterIcon,
  FolderIcon,
  getAvatarColor,
  getAvatarLabel,
  getHostDesc,
  getHostName,
  getTagTone,
  HostTagsSelect,
  JumpIcon,
  MoreIcon,
  TerminalIcon,
  useHosts,
  useTerminalsAtomWithApi,
} from "shared";

import AddHost from "@/components/AddHost";
import Empty from "@/components/Empty";
import ListToolbar from "@/components/ListToolbar";
import PanelTable from "@/components/PanelTable";
import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { useListView } from "@/hooks/useListView";
import useMessage from "@/hooks/useMessage";
import { filterByKeyword } from "@/utils/list";
import HostActionsMenu from "./HostActionsMenu";
import styles from "./index.module.less";

function getHostTags(host: Host) {
  return (host.tags || []).filter((tag) => tag.trim()).map((tag) => tag.trim());
}

function getTagColor(tag: string) {
  switch (getTagTone(tag)) {
    case "Prod":
      return "red" as const;
    case "Staging":
      return "amber" as const;
    case "Local":
      return "green" as const;
    default:
      return "indigo" as const;
  }
}

export default function Hosts() {
  const { keyword, setKeyword, viewMode, setViewMode } = useListView();
  const [selectedTag, setSelectedTag] = useState<string>();
  const [isOpenAddHost, setIsOpenAddHost] = useState(false);
  const [editHost, setEditHost] = useState<Host>();
  const activateTerminal = useActivateTerminal();

  const confirmDelete = useConfirmDelete();
  const message = useMessage();

  const { data: hosts = [], refresh: refreshHosts } = useHosts();

  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const items = useMemo(() => {
    let filtered = hosts;
    if (selectedTag) {
      filtered = filtered.filter((item) => item.tags?.includes(selectedTag));
    }
    return filterByKeyword(filtered, keyword, [
      (item) => item.name,
      (item) => `${item.hostname}:${item.port}`,
    ]);
  }, [hosts, keyword, selectedTag]);

  const onOpenChannel = useCallback(
    (host: Host) => {
      const [item] = terminalsAtomWithApi.add(host);
      activateTerminal(item.uuid);
    },
    [activateTerminal, terminalsAtomWithApi],
  );

  const onOpenSftp = useCallback(
    (host: Host) => {
      const [item] = terminalsAtomWithApi.addSftp(host);
      activateTerminal(item.uuid);
    },
    [activateTerminal, terminalsAtomWithApi],
  );

  const onAddHostClose = useCallback(() => {
    setIsOpenAddHost(false);
    setEditHost(undefined);
  }, []);

  const handleOpenLocalShell = useCallback(() => {
    const [item] = terminalsAtomWithApi.addLocal();
    activateTerminal(item.uuid);
  }, [activateTerminal, terminalsAtomWithApi]);

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
        message.error({ message: get(err, "message") || "Copy failed" });
      }
    },
    [message, refreshHosts],
  );

  const onDeleteHost = useCallback(
    (host: Host) => {
      const hostname = host.name || `${host.hostname}:${host.port}`;
      confirmDelete({
        content: `Are you sure to delete the host: ${hostname}?`,
        onDelete: () => deleteHost(host),
        onSuccess: refreshHosts,
      });
    },
    [confirmDelete, refreshHosts],
  );

  return (
    <>
      <div className={styles.page}>
        <ListToolbar
          title="Hosts"
          keyword={keyword}
          onKeywordChange={setKeyword}
          searchPlaceholder="Search hosts..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          leading={
            <HostTagsSelect value={selectedTag} onChange={setSelectedTag}>
              {({ label }) => (
                <Button
                  type="button"
                  variant="soft"
                  className={clsx(
                    styles.toolbarButton,
                    selectedTag && styles.filterActive,
                  )}
                >
                  <FilterIcon width="11" height="11" />
                  {label}
                </Button>
              )}
            </HostTagsSelect>
          }
        >
          <Flex gap="0" className={styles.splitButton}>
            <Button
              type="button"
              variant="soft"
              className={styles.toolbarPrimaryButton}
              onClick={() => setIsOpenAddHost(true)}
            >
              <AddIcon width="11" height="11" />
              New Host
            </Button>
            <Button
              type="button"
              variant="soft"
              className={styles.toolbarButton}
              onClick={handleOpenLocalShell}
            >
              <TerminalIcon width="11" height="11" />
              Local Shell
            </Button>
          </Flex>
        </ListToolbar>
        <div className={styles.content}>
          {items.length > 0 ? (
            viewMode === "grid" ? (
              <div className={styles.grid}>
                {items.map((item) => {
                  const name = getHostName(item);
                  const desc = getHostDesc(item);
                  const avatarBg = getAvatarColor(name);
                  const jumpCount = item.jumpHostIds?.length ?? 0;
                  const tags = getHostTags(item);

                  return (
                    <article
                      key={item.id}
                      className={styles.card}
                      onDoubleClick={() => onOpenChannel(item)}
                    >
                      <div className={styles.cardHead}>
                        <div
                          className={styles.avatar}
                          style={{
                            background: `color-mix(in srgb, ${avatarBg} 14%, transparent)`,
                            color: avatarBg,
                          }}
                        >
                          {getAvatarLabel(name)}
                        </div>
                        <div className={styles.cardInfo}>
                          <div className={styles.name}>{name}</div>
                          <div className={styles.addr}>{desc}</div>
                          {jumpCount > 0 && (
                            <div className={styles.cardMetaInline}>
                              <span className={styles.metaPill}>
                                <JumpIcon className={styles.auxMetaIcon} />
                                {jumpCount} jump{jumpCount > 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                        {tags.length > 0 && (
                          <div className={styles.cardTags}>
                            {tags.map((tag) => (
                              <Badge
                                key={tag}
                                color={getTagColor(tag)}
                                size="1"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.cardFooter}>
                        <button
                          type="button"
                          className={styles.connectBtn}
                          onClick={() => onOpenChannel(item)}
                        >
                          <TerminalIcon width="11" height="11" />
                          Terminal
                        </button>
                        <button
                          type="button"
                          className={clsx(
                            styles.connectBtn,
                            styles.connectBtnSecondary,
                          )}
                          onClick={() => onOpenSftp(item)}
                        >
                          <FolderIcon width="11" height="11" />
                          SFTP
                        </button>
                        <HostActionsMenu
                          host={item}
                          onEdit={onEditHost}
                          onCopy={onCopyHost}
                          onDelete={onDeleteHost}
                          trigger={
                            <button type="button" className={styles.moreBtn}>
                              <MoreIcon width="12" height="12" />
                            </button>
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.listView}>
                <PanelTable>
                  <thead>
                    <tr>
                      <th>Host</th>
                      <th>Address</th>
                      <th>Tags</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const tags = getHostTags(item);
                      return (
                        <tr
                          key={item.id}
                          onDoubleClick={() => onOpenChannel(item)}
                        >
                          <td className={styles.listName}>
                            {getHostName(item)}
                          </td>
                          <td className={styles.listAddr}>
                            {getHostDesc(item)}
                          </td>
                          <td>
                            <div className={styles.listTags}>
                              {tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  color={getTagColor(tag)}
                                  size="1"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td>
                            <Flex gap="1">
                              <Button
                                type="button"
                                size="1"
                                variant="ghost"
                                className={styles.actionButton}
                                onClick={() => onOpenChannel(item)}
                              >
                                Terminal
                              </Button>
                              <Button
                                type="button"
                                size="1"
                                variant="ghost"
                                className={styles.actionButton}
                                onClick={() => onOpenSftp(item)}
                              >
                                SFTP
                              </Button>
                              <HostActionsMenu
                                host={item}
                                onEdit={onEditHost}
                                onCopy={onCopyHost}
                                onDelete={onDeleteHost}
                                trigger={
                                  <IconButton
                                    type="button"
                                    size="1"
                                    variant="ghost"
                                    color="gray"
                                  >
                                    <MoreIcon />
                                  </IconButton>
                                }
                              />
                            </Flex>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </PanelTable>
              </div>
            )
          ) : (
            <Empty desc="No hosts yet. Add one to get started.">
              <Button
                type="button"
                variant="soft"
                className={styles.toolbarPrimaryButton}
                onClick={() => setIsOpenAddHost(true)}
              >
                New Host
              </Button>
            </Empty>
          )}
        </div>
      </div>

      <AddHost
        open={isOpenAddHost}
        data={editHost}
        onOk={onAddHostClose}
        onCancel={onAddHostClose}
      />
    </>
  );
}
