import { IconButton } from "@radix-ui/themes";
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
import { addHost, deleteHost, type Host } from "tauri-plugin-data";

import AddHost from "@/components/AddHost";
import Empty from "@/components/Empty";
import ListToolbar from "@/components/ListToolbar";
import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { useListView } from "@/hooks/useListView";
import useMessage from "@/hooks/useMessage";
import panel from "@/styles/panel.module.less";
import { filterByKeyword } from "@/utils/list";
import HostActionsMenu from "./HostActionsMenu";
import styles from "./index.module.less";

function getHostTags(host: Host) {
  return (host.tags || []).filter((tag) => tag.trim()).map((tag) => tag.trim());
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
      <section className={panel.page}>
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
                <button
                  type="button"
                  className={clsx(
                    panel.button,
                    selectedTag && panel.buttonPrimary,
                  )}
                >
                  <FilterIcon width="11" height="11" />
                  {label}
                </button>
              )}
            </HostTagsSelect>
          }
        >
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenAddHost(true)}
          >
            <AddIcon width="11" height="11" />
            New Host
          </button>
        </ListToolbar>
        <div className={panel.content}>
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
                              <span
                                key={tag}
                                className={clsx(
                                  panel.tag,
                                  panel[`tag${getTagTone(tag)}`],
                                )}
                              >
                                {tag}
                              </span>
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
                <div className={panel.tableWrap}>
                  <table className={panel.table}>
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
                                  <span
                                    key={tag}
                                    className={clsx(
                                      panel.tag,
                                      panel[`tag${getTagTone(tag)}`],
                                    )}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div className={panel.actionGroup}>
                                <button
                                  type="button"
                                  className={panel.actionButton}
                                  onClick={() => onOpenChannel(item)}
                                >
                                  Terminal
                                </button>
                                <button
                                  type="button"
                                  className={panel.actionButton}
                                  onClick={() => onOpenSftp(item)}
                                >
                                  SFTP
                                </button>
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
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            <Empty desc="No hosts yet. Add one to get started.">
              <button
                type="button"
                className={clsx(panel.button, panel.buttonPrimary)}
                onClick={() => setIsOpenAddHost(true)}
              >
                New Host
              </button>
            </Empty>
          )}
        </div>
      </section>

      <AddHost
        open={isOpenAddHost}
        data={editHost}
        onOk={onAddHostClose}
        onCancel={onAddHostClose}
      />
    </>
  );
}
