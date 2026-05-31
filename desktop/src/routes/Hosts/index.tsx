import { DropdownMenu, IconButton } from "@radix-ui/themes";
import clsx from "clsx";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  ContentCopyIcon,
  DeleteIcon,
  EditIcon,
  FilterIcon,
  GridIcon,
  getHostDesc,
  getHostName,
  HostTagsSelect,
  JumpIcon,
  ListIcon,
  MoreIcon,
  SearchIcon,
  SftpIcon,
  TerminalIcon,
  useHosts,
  useTerminalsAtomWithApi,
} from "shared";
import { addHost, deleteHost, type Host } from "tauri-plugin-data";

import AddHost from "@/components/AddHost";
import Empty from "@/components/Empty";
import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import panel from "@/styles/panel.module.less";
import styles from "./index.module.less";

const AVATAR_COLORS = ["#4285f4", "#27ae60", "#f59e0b", "#7c5cbf", "#e53935"];

function getAvatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function getAvatarLabel(name: string) {
  const words = name
    .split(/[\s-_:/.]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

type HostTone = "Prod" | "Staging" | "Local" | "Accent";

function getHostTone(tag: string): HostTone {
  const normalized = tag.trim().toLowerCase();
  if (normalized.includes("prod")) {
    return "Prod";
  }
  if (normalized.includes("stag")) {
    return "Staging";
  }
  if (normalized.includes("local")) {
    return "Local";
  }
  return "Accent";
}

function getHostTags(host: Host) {
  return (host.tags || []).filter((tag) => tag.trim()).map((tag) => tag.trim());
}

export default function Hosts() {
  const [keyword, setKeyword] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>();
  const [isOpenAddHost, setIsOpenAddHost] = useState(false);
  const [editHost, setEditHost] = useState<Host>();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const activateTerminal = useActivateTerminal();

  const modal = useModal();
  const message = useMessage();

  const { data: hosts = [], refresh: refreshHosts } = useHosts();

  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let filtered = hosts;
    if (selectedTag) {
      filtered = filtered.filter((item) => item.tags?.includes(selectedTag));
    }
    if (!kw) return filtered;
    return filtered.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw),
    );
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
      modal.confirm({
        title: "Delete Confirmation",
        content: `Are you sure to delete the host: ${hostname}?`,
        OkButtonProps: { color: "orange" },
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
    [modal, refreshHosts, message],
  );

  return (
    <>
      <section className={panel.page}>
        <div className={panel.toolbar}>
          <span className={panel.title}>Hosts</span>
          <label className={panel.search}>
            <SearchIcon className={panel.searchIcon} />
            <input
              className={panel.searchInput}
              value={keyword}
              placeholder="Search hosts..."
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
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
          <div className={panel.toggleGroup}>
            <button
              type="button"
              className={clsx(
                panel.toggleButton,
                viewMode === "grid" && panel.toggleButtonActive,
              )}
              title="Grid view"
              onClick={() => setViewMode("grid")}
            >
              <GridIcon width="12" height="12" />
            </button>
            <button
              type="button"
              className={clsx(
                panel.toggleButton,
                viewMode === "list" && panel.toggleButtonActive,
              )}
              title="List view"
              onClick={() => setViewMode("list")}
            >
              <ListIcon width="12" height="12" />
            </button>
          </div>
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenAddHost(true)}
          >
            <AddIcon width="11" height="11" />
            New Host
          </button>
        </div>
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
                                  panel[`tag${getHostTone(tag)}`],
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
                          Open Terminal
                        </button>
                        <button
                          type="button"
                          className={clsx(
                            styles.connectBtn,
                            styles.connectBtnSecondary,
                          )}
                          onClick={() => onOpenSftp(item)}
                        >
                          <SftpIcon width="11" height="11" />
                          SFTP
                        </button>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <button type="button" className={styles.moreBtn}>
                              <MoreIcon width="12" height="12" />
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
                            <DropdownMenu.Item
                              onSelect={() => onCopyHost(item)}
                            >
                              <ContentCopyIcon style={{ marginRight: 8 }} />
                              Copy
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onSelect={() => onDeleteHost(item)}
                            >
                              <DeleteIcon style={{ marginRight: 8 }} />
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
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
                                      panel[`tag${getHostTone(tag)}`],
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
                                  Open
                                </button>
                                <button
                                  type="button"
                                  className={panel.actionButton}
                                  onClick={() => onOpenSftp(item)}
                                >
                                  SFTP
                                </button>
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger>
                                    <IconButton
                                      type="button"
                                      size="1"
                                      variant="ghost"
                                      color="gray"
                                    >
                                      <MoreIcon />
                                    </IconButton>
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
                                    <DropdownMenu.Item
                                      onSelect={() => onCopyHost(item)}
                                    >
                                      <ContentCopyIcon
                                        style={{ marginRight: 8 }}
                                      />
                                      Copy
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      onSelect={() => onDeleteHost(item)}
                                    >
                                      <DeleteIcon style={{ marginRight: 8 }} />
                                      Delete
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Root>
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
