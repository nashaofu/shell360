import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { type MouseEvent, useCallback, useMemo, useState } from "react";
import {
  DeleteIcon,
  FingerprintIcon,
  type KnownHost,
  useKnownHostsStore,
} from "shared";
import AutoRepeatGrid from "@/components/AutoRepeatGrid";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import styles from "./index.module.less";

const KNOWN_HOSTS_PATH = "./known_hosts";
const KNOWN_HOSTS_BASE_DIR = BaseDirectory.AppLocalData;

export default function KnownHosts() {
  const [keyword, setKeyword] = useState("");
  const modal = useModal();
  const message = useMessage();
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
            await remove(knownHost);
          } catch (err) {
            message.error(
              `Failed to delete: ${(err as Error).message ?? "Unknown error"}`,
            );
          }
        },
      });
    },
    [modal, message.error, remove],
  );

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) {
      return items;
    }

    return items.filter((item) =>
      [item.host, item.type, item.key, item.marker].some((value) =>
        value?.toLowerCase().includes(kw),
      ),
    );
  }, [items, keyword]);

  return (
    <Page title="Known hosts">
      <input
        className="rt-reset rt-TextFieldInput"
        value={keyword}
        style={{
          width: "100%",
          paddingLeft: 8,
          paddingRight: 8,
          height: 36,
          margin: "16px 0",
        }}
        placeholder="Search..."
        onChange={(event) => setKeyword(event.target.value)}
      />
      <AutoRepeatGrid
        sx={{
          gap: 2,
        }}
        itemWidth={280}
      >
        {filteredItems.map((item) => (
          <ItemCard
            key={item.id}
            icon={<FingerprintIcon />}
            title={item.host}
            desc={item.type}
            extra={
              <button
                type="button"
                className={styles.deleteButton}
                onClick={(event) => onDelete(event, item)}
              >
                <DeleteIcon />
              </button>
            }
          />
        ))}
      </AutoRepeatGrid>
      {!filteredItems.length && (
        <Empty
          desc={
            items.length
              ? "No known hosts match your search."
              : "There is no known hosts yet."
          }
        />
      )}
    </Page>
  );
}
