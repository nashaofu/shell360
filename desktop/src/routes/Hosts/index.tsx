import { DropdownMenu, IconButton } from "@radix-ui/themes";
import clsx from "clsx";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  getHostDesc,
  getHostName,
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

function getPrimaryTag(host: Host) {
  return host.tags?.find((tag) => tag.trim())?.trim() || "Untagged";
}

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

export default function Hosts() {
  const [keyword, setKeyword] = useState("");
  const selectedHostRef = useRef<Host>(null);
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
    if (!kw) return hosts;
    return hosts.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        `${item.hostname}:${item.port}`.toLowerCase().includes(kw),
    );
  }, [hosts, keyword]);

  const groups = useMemo(() => {
    const grouped = new Map<string, Host[]>();

    for (const item of items) {
      const tag = getPrimaryTag(item);
      const group = grouped.get(tag) ?? [];
      group.push(item);
      grouped.set(tag, group);
    }

    return Array.from(grouped.entries())
      .sort(([left], [right]) => {
        if (left === "Untagged") {
          return 1;
        }
        if (right === "Untagged") {
          return -1;
        }
        return left.localeCompare(right);
      })
      .map(([label, groupItems]) => ({
        label,
        tone: getHostTone(label),
        items: groupItems,
      }));
  }, [items]);

  const listItems = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          groupLabel: group.label,
          groupTone: group.tone,
        })),
      ),
    [groups],
  );

  const onOpenChannel = useCallback(
    (host: Host) => {
      const [item] = terminalsAtomWithApi.add(host);
      activateTerminal(item.uuid);
    },
    [activateTerminal, terminalsAtomWithApi],
  );

  const onAddHostClose = useCallback(() => {
    setIsOpenAddHost(false);
    setEditHost(undefined);
  }, []);

  const onCopyHost = useCallback(async () => {
    const selectedHost = selectedHostRef.current;
    selectedHostRef.current = null;
    if (!selectedHost) return;
    try {
      const copiedHost = await addHost({
        ...omit(selectedHost, ["id"]),
        name: `${getHostName(selectedHost)} Copy`,
      });
      await refreshHosts();
      setEditHost(copiedHost);
      setIsOpenAddHost(true);
    } catch (err) {
      message.error({ message: get(err, "message") || "Copy failed" });
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
          if (!selectedHost) return;
          const hostname =
            selectedHost.name ||
            `${selectedHost.hostname}:${selectedHost.port}`;
          modal.confirm({
            title: "Delete Confirmation",
            content: `Are you sure to delete the host: ${hostname}?`,
            OkButtonProps: { color: "orange" },
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
    <>
      <section className={panel.page}>
        <div className={panel.toolbar}>
          <span className={panel.title}>Hosts</span>
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
              placeholder="Search hosts..."
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
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
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="4"
                  height="4"
                  rx="0.8"
                  fill="currentColor"
                />
                <rect
                  x="7"
                  y="1"
                  width="4"
                  height="4"
                  rx="0.8"
                  fill="currentColor"
                />
                <rect
                  x="1"
                  y="7"
                  width="4"
                  height="4"
                  rx="0.8"
                  fill="currentColor"
                />
                <rect
                  x="7"
                  y="7"
                  width="4"
                  height="4"
                  rx="0.8"
                  fill="currentColor"
                />
              </svg>
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
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M1 3h10M1 6h10M1 9h10"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <button type="button" className={panel.button}>
            Import
          </button>
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenAddHost(true)}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 1v10M1 6h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            New Host
          </button>
        </div>
        <div className={panel.content}>
          {items.length > 0 ? (
            viewMode === "grid" ? (
              groups.map((group) => (
                <section key={group.label} className={styles.group}>
                  <div className={panel.sectionLabel}>
                    <span>{group.label}</span>
                    <span className={panel.sectionCount}>
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "host" : "hosts"}
                    </span>
                  </div>
                  <div className={styles.grid}>
                    {group.items.map((item) => {
                      const name = getHostName(item);
                      const desc = getHostDesc(item);
                      const avatarBg = getAvatarColor(name);
                      const isLocal = group.tone === "Local";
                      const statusClassName = isLocal
                        ? styles.statusTextActive
                        : styles.statusTextIdle;
                      const dotClassName = isLocal
                        ? panel.statusActive
                        : panel.statusIdle;

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
                            </div>
                            <span
                              className={clsx(
                                panel.tag,
                                panel[`tag${group.tone}`],
                              )}
                            >
                              {group.label}
                            </span>
                          </div>
                          <div className={styles.statusRow}>
                            <span
                              className={clsx(panel.statusDot, dotClassName)}
                            />
                            <span className={statusClassName}>
                              {isLocal ? "Connected" : "Idle"}
                            </span>
                            <span className={styles.auxMeta}>
                              <svg
                                className={styles.auxMetaIcon}
                                viewBox="0 0 14 14"
                                fill="none"
                              >
                                <circle
                                  cx="7"
                                  cy="7"
                                  r="5.5"
                                  stroke="currentColor"
                                  strokeWidth="1.1"
                                />
                                <path
                                  d="M7 1.5C7 1.5 4 5 4 7C4 9 5.3 10.5 7 10.5C8.7 10.5 10 9 10 7C10 5 7 1.5 7 1.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1"
                                />
                              </svg>
                              {item.authenticationMethod}
                              {!!item.jumpHostIds?.length &&
                                ` · ${item.jumpHostIds.length} jump${item.jumpHostIds.length > 1 ? "s" : ""}`}
                            </span>
                          </div>
                          <div className={styles.cardFooter}>
                            <button
                              type="button"
                              className={styles.connectBtn}
                              onClick={() => onOpenChannel(item)}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 12 12"
                                fill="none"
                              >
                                <rect
                                  x="1.5"
                                  y="2.5"
                                  width="9"
                                  height="7"
                                  rx="1"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                />
                                <path
                                  d="M3 5.5l1.5 1.5L3 8.5"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M7 8.5h2"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                              Open Terminal
                            </button>
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger>
                                <button
                                  type="button"
                                  className={styles.moreBtn}
                                  onClick={() => {
                                    selectedHostRef.current = item;
                                  }}
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                  >
                                    <circle
                                      cx="6"
                                      cy="2.5"
                                      r="1"
                                      fill="currentColor"
                                    />
                                    <circle
                                      cx="6"
                                      cy="6"
                                      r="1"
                                      fill="currentColor"
                                    />
                                    <circle
                                      cx="6"
                                      cy="9.5"
                                      r="1"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content
                                side="bottom"
                                align="end"
                                sideOffset={4}
                              >
                                {menus.map((menuItem) => (
                                  <DropdownMenu.Item
                                    key={menuItem.value}
                                    onSelect={() => menuItem.onClick?.()}
                                  >
                                    {menuItem.label}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className={styles.listView}>
                <div className={panel.tableWrap}>
                  <table className={panel.table}>
                    <thead>
                      <tr>
                        <th>Host</th>
                        <th>Address</th>
                        <th>Label</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {listItems.map((item) => {
                        const isLocal = item.groupTone === "Local";
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
                              <span
                                className={clsx(
                                  panel.tag,
                                  panel[`tag${item.groupTone}`],
                                )}
                              >
                                {item.groupLabel}
                              </span>
                            </td>
                            <td className={styles.listStatus}>
                              <span
                                className={clsx(
                                  panel.statusDot,
                                  isLocal
                                    ? panel.statusActive
                                    : panel.statusIdle,
                                )}
                              />
                              <span>{isLocal ? "Connected" : "Idle"}</span>
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
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger>
                                    <IconButton
                                      type="button"
                                      size="1"
                                      variant="ghost"
                                      color="gray"
                                      onClick={() => {
                                        selectedHostRef.current = item;
                                      }}
                                    >
                                      <span className="icon-more" />
                                    </IconButton>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Content
                                    side="bottom"
                                    align="end"
                                    sideOffset={4}
                                  >
                                    {menus.map((menuItem) => (
                                      <DropdownMenu.Item
                                        key={menuItem.value}
                                        onSelect={() => menuItem.onClick?.()}
                                      >
                                        {menuItem.label}
                                      </DropdownMenu.Item>
                                    ))}
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
