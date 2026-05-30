import clsx from "clsx";
import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { message } from "shared";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import { copy } from "@/utils/clipboard";
import Empty from "@/components/Empty";
import panel from "@/styles/panel.module.less";
import styles from "./index.module.less";

async function readKnownHost() {
  const data = await readTextFile("./known_hosts", {
    baseDir: BaseDirectory.AppLocalData,
  });

  const knownHosts = data
    .split(/\r|\n/)
    .filter(Boolean)
    .map((item) => {
      const result = item.split(" ").filter(Boolean);
      return {
        id: item,
        host: result[0],
        type: result[1],
        key: result[2],
      };
    });

  return knownHosts;
}

type KnownHost = {
  id: string;
  host: string;
  type: string;
  key: string;
};

function getKnownHostTone(host: string) {
  const normalized = host.toLowerCase();
  if (normalized.includes("prod") || normalized.startsWith("10.0.")) {
    return "Prod";
  }
  if (normalized.includes("stag") || normalized.startsWith("10.1.")) {
    return "Staging";
  }
  if (normalized.includes("local") || normalized.includes("127.0.0.1")) {
    return "Local";
  }
  return "Accent";
}

function getKnownHostLabel(host: string) {
  return host.split(/[,:]/)[0] || host;
}

function getFingerprint(key: string) {
  if (key.length <= 18) {
    return key;
  }

  return `${key.slice(0, 12)}...${key.slice(-4)}`;
}

export default function KnownHosts() {
  const [items, setItems] = useState<KnownHost[]>([]);
  const [keyword, setKeyword] = useState("");
  const modal = useModal();
  const message = useMessage();

  const onDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>, knownHost: KnownHost) => {
      event.stopPropagation();

      const knownHostContent = ` ${knownHost.host} ${knownHost.type} ${knownHost.key}`;
      modal.confirm({
        title: "Delete Confirmation",
        content: (
          <div className={styles.confirmContent}>
            Are you sure to delete the known host:
            {knownHostContent}?
          </div>
        ),
        OkButtonProps: {
          color: "orange",
        },
        onOk: async () => {
          try {
            const knownHosts = await readKnownHost();

            const newItems = knownHosts.filter(
              (item) => item.id !== knownHost.id,
            );
            const data = newItems
              .map((item) => `${item.host} ${item.type} ${item.key}`)
              .join("\r\n");

            await writeTextFile("./known_hosts", data, {
              baseDir: BaseDirectory.AppLocalData,
            });

            setItems(newItems);
          } catch (err) {
            message.error(
              `Failed to delete: ${(err as Error).message ?? "Unknown error"}`,
            );
          }
        },
      });
    },
    [modal],
  );

  const onExport = useCallback(() => {
    if (!items.length) {
      return;
    }

    copy(items.map((item) => item.id).join("\r\n"));
    message.success({ message: "Copied known_hosts entries" });
  }, [items, message]);

  const onClearAll = useCallback(() => {
    modal.confirm({
      title: "Clear known_hosts",
      content: "Remove all saved known_hosts entries from this device?",
      OkButtonProps: {
        color: "orange",
      },
      onOk: async () => {
        try {
          await writeTextFile("./known_hosts", "", {
            baseDir: BaseDirectory.AppLocalData,
          });
          setItems([]);
        } catch (err) {
          message.error(
            `Failed to clear: ${(err as Error).message ?? "Unknown error"}`,
          );
        }
      },
    });
  }, [modal]);

  useEffect(() => {
    readKnownHost().then((knownHosts) => setItems(knownHosts));
  }, []);

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    if (!kw) {
      return items;
    }

    return items.filter(
      (item) =>
        item.host.toLowerCase().includes(kw) ||
        item.type.toLowerCase().includes(kw) ||
        item.key.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  return (
    <section className={panel.page}>
        <div className={panel.toolbar}>
          <span className={panel.title}>Known Hosts</span>
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
              placeholder="Filter hosts..."
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <button type="button" className={panel.button} onClick={onExport}>
            Export
          </button>
          <button
            type="button"
            className={clsx(panel.button, panel.buttonDanger)}
            onClick={onClearAll}
          >
            Clear All
          </button>
        </div>
        <div className={panel.content}>
          {filteredItems.length ? (
            <div className={panel.tableWrap}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th>Hostname / IP</th>
                    <th>Key Type</th>
                    <th>Fingerprint</th>
                    <th>Saved</th>
                    <th>State</th>
                    <th>Label</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.hostCell}>{item.host}</td>
                      <td>
                        <span className={`${panel.tag} ${panel.tagAccent}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className={styles.fingerprintCell}>
                        {getFingerprint(item.key)}
                      </td>
                      <td className={styles.timeCell}>Saved entry</td>
                      <td className={styles.timeCell}>Available</td>
                      <td>
                        <span
                          className={clsx(
                            panel.tag,
                            panel[`tag${getKnownHostTone(item.host)}`],
                          )}
                        >
                          {getKnownHostLabel(item.host)}
                        </span>
                      </td>
                      <td>
                        <div className={panel.actionGroup}>
                          <button
                            type="button"
                            className={`${panel.actionButton} ${panel.dangerButton}`}
                            onClick={(event) => onDelete(event, item)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty desc="There is no known hosts yet." />
          )}
        </div>
    </section>
  );
}
