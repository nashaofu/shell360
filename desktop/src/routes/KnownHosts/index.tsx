import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import clsx from "clsx";
import { type MouseEvent, useCallback, useMemo, useState } from "react";
import { getTagTone, type KnownHost, useKnownHostsStore } from "shared";
import Empty from "@/components/Empty";
import ListToolbar from "@/components/ListToolbar";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import panel from "@/styles/panel.module.less";
import { filterByKeyword } from "@/utils/list";
import styles from "./index.module.less";

const KNOWN_HOSTS_PATH = "./known_hosts";
const KNOWN_HOSTS_BASE_DIR = BaseDirectory.AppLocalData;

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
  const [keyword, setKeyword] = useState("");
  const confirmDelete = useConfirmDelete();
  const { items, remove } = useKnownHostsStore({
    readText: useCallback(async () => {
      try {
        return await readTextFile(KNOWN_HOSTS_PATH, {
          baseDir: KNOWN_HOSTS_BASE_DIR,
        });
      } catch {
        return "";
      }
    }, []),
    writeText: useCallback(async (data: string) => {
      await writeTextFile(KNOWN_HOSTS_PATH, data, {
        baseDir: KNOWN_HOSTS_BASE_DIR,
      });
    }, []),
  });

  const onDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>, knownHost: KnownHost) => {
      event.stopPropagation();

      const knownHostContent = knownHost.rawLine;
      confirmDelete({
        content: (
          <div className={styles.confirmContent}>
            Are you sure to delete the known host:
            {knownHostContent}?
          </div>
        ),
        failureMessage: "Failed to delete",
        onDelete: async () => {
          await remove(knownHost);
        },
      });
    },
    [confirmDelete, remove],
  );

  const filteredItems = useMemo(() => {
    return filterByKeyword(items, keyword, [
      (item) => item.host,
      (item) => item.type,
      (item) => item.key,
    ]);
  }, [items, keyword]);

  return (
    <section className={panel.page}>
      <ListToolbar
        title="Known Hosts"
        keyword={keyword}
        onKeywordChange={setKeyword}
        searchPlaceholder="Filter hosts..."
      />
      <div className={panel.content}>
        {filteredItems.length ? (
          <div className={panel.tableWrap}>
            <table className={panel.table}>
              <thead>
                <tr>
                  <th>Hostname / IP</th>
                  <th>Key Type</th>
                  <th>Fingerprint</th>
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
                    <td>
                      <span
                        className={clsx(
                          panel.tag,
                          panel[`tag${getTagTone(item.host)}`],
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
