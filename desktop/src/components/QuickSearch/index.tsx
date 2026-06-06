import { Portal, Theme } from "@radix-ui/themes";
import clsx from "clsx";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FingerprintIcon,
  getHostDesc,
  getHostName,
  HostIcon,
  KeyIcon,
  SearchIcon,
  SettingsIcon,
  SftpIcon,
  SiteMapIcon,
  TerminalIcon,
  useHosts,
  useTerminalsAtomValue,
  useTerminalsAtomWithApi,
} from "shared";

import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import styles from "./index.module.less";

interface SearchItem {
  key: string;
  section: string;
  label: string;
  description?: string;
  icon: ReactNode;
  onSelect: () => void;
}

interface QuickSearchProps {
  open: boolean;
  onClose: () => void;
}

const PAGE_ICONS: Record<string, ReactNode> = {
  "/": <HostIcon />,
  "/port-forwardings": <SiteMapIcon />,
  "/keys": <KeyIcon />,
  "/known-hosts": <FingerprintIcon />,
  "/settings": <SettingsIcon />,
};

const PAGES = [
  { path: "/", label: "Hosts" },
  { path: "/port-forwardings", label: "Port Forwardings" },
  { path: "/keys", label: "Keys" },
  { path: "/known-hosts", label: "Known Hosts" },
  { path: "/settings", label: "Settings" },
];

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export default function QuickSearch({ open, onClose }: QuickSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const activateTerminal = useActivateTerminal();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const { data: hosts } = useHosts();
  const terminals = useTerminalsAtomValue();

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (timerRef.current !== null) return;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setClosing(false);
      setQuery("");
      setSelectedIndex(0);
      onClose();
    }, 150);
  }, [onClose]);

  const items = useMemo(() => {
    const result: SearchItem[] = [];
    const q = query.trim();

    for (const page of PAGES) {
      if (!matches(q, page.label)) continue;
      result.push({
        key: `page:${page.path}`,
        section: "Pages",
        label: page.label,
        icon: PAGE_ICONS[page.path],
        onSelect: () => {
          navigate(page.path);
          handleClose();
        },
      });
    }

    for (const host of hosts) {
      const name = getHostName(host);
      if (!matches(q, name, host.hostname, host.username)) continue;
      result.push({
        key: `host:${host.id}`,
        section: "Hosts",
        label: name,
        description: getHostDesc(host),
        icon: <HostIcon />,
        onSelect: () => {
          const [item] = terminalsAtomWithApi.add(host);
          activateTerminal(item.uuid);
          handleClose();
        },
      });
    }

    for (const [, terminal] of terminals) {
      if (!matches(q, terminal.name)) continue;
      result.push({
        key: `session:${terminal.uuid}`,
        section: "Active Sessions",
        label: terminal.name,
        description: terminal.type === "sftp" ? "SFTP" : "Terminal",
        icon: terminal.type === "sftp" ? <SftpIcon /> : <TerminalIcon />,
        onSelect: () => {
          activateTerminal(terminal.uuid);
          handleClose();
        },
      });
    }

    return result;
  }, [
    query,
    hosts,
    terminals,
    navigate,
    handleClose,
    activateTerminal,
    terminalsAtomWithApi,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter" && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].onSelect();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, items, selectedIndex, handleClose]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.querySelector(`[data-index="${selectedIndex}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const item of items) {
      const group = map.get(item.section);
      if (group) {
        group.push(item);
      } else {
        map.set(item.section, [item]);
      }
    }
    return map;
  }, [items]);

  if (!open && !closing) return null;

  let flatIndex = 0;

  return (
    <Portal>
      <Theme asChild>
        <div
          className={clsx(styles.overlay, closing && styles.closingOverlay)}
          onClick={handleClose}
        >
          <div
            className={clsx(styles.panel, closing && styles.closingPanel)}
            role="dialog"
            aria-modal="true"
            aria-label="Quick search"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <SearchIcon />
              </span>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                placeholder="Search hosts, pages, sessions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <span className={styles.inputShortcut}>
                <kbd>ESC</kbd>
              </span>
            </div>

            {items.length > 0 ? (
              <div className={styles.results} ref={listRef}>
                {[...groupedItems.entries()].map(([section, sectionItems]) => (
                  <div key={section}>
                    <div className={styles.sectionLabel}>{section}</div>
                    {sectionItems.map((item) => {
                      const currentIndex = flatIndex++;
                      return (
                        <div
                          key={item.key}
                          className={clsx(
                            styles.item,
                            selectedIndex === currentIndex && styles.selected,
                          )}
                          data-index={currentIndex}
                          onClick={item.onSelect}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                        >
                          <span className={styles.itemIcon}>{item.icon}</span>
                          <div className={styles.itemInfo}>
                            <div className={styles.itemLabel}>{item.label}</div>
                            {item.description && (
                              <div className={styles.itemDesc}>
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                {query ? "No results found" : "Start typing to search..."}
              </div>
            )}
          </div>
        </div>
      </Theme>
    </Portal>
  );
}
