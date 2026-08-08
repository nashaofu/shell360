import { DropdownMenu, IconButton } from "@radix-ui/themes";
import { hasCapability } from "bridge/capabilities";
import { BaseDirectory, readTextFile, writeTextFile } from "bridge/fs";
import { useCallback, useMemo, useState } from "react";
import {
  DeleteIcon,
  FingerprintIcon,
  type KnownHost,
  MoreIcon,
  useKnownHostsStore,
} from "shared";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
import SearchToolbar from "@/components/SearchToolbar";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";

const KNOWN_HOSTS_PATH = "./known_hosts";
const KNOWN_HOSTS_BASE_DIR = BaseDirectory.AppLocalData;

function getFingerprint(key: string) {
  if (key.length <= 18) {
    return key;
  }
  return `${key.slice(0, 12)}...${key.slice(-4)}`;
}

export default function KnownHosts() {
  const isAvailable = hasCapability("fileSystem");
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
    (knownHost: KnownHost) => {
      const knownHostContent = knownHost.rawLine;
      modal.confirm({
        title: "Delete Confirmation",
        content: `Are you sure to delete the known host: ${knownHostContent}?`,
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
    <Page title="Known Hosts">
      {!isAvailable ? (
        <Empty desc="Known hosts management is not available on this platform yet." />
      ) : (
        <>
          <SearchToolbar
            value={keyword}
            placeholder="Search hostname or fingerprint"
            onChange={setKeyword}
          />

          {filteredItems.map((item) => (
            <div className={styles.listItem} key={item.id}>
              <ItemCard
                icon={<FingerprintIcon />}
                title={item.host}
                desc={
                  <span className={styles.monospace}>
                    {getFingerprint(item.key)}
                  </span>
                }
                extra={
                  <span onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <IconButton
                          type="button"
                          size="3"
                          variant="ghost"
                          className={styles.moreAction}
                          aria-label={`More actions for ${item.host}`}
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
                          onSelect={() => onDelete(item)}
                          color="red"
                        >
                          <DeleteIcon style={{ marginRight: 8 }} />
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </span>
                }
              />
            </div>
          ))}

          {!filteredItems.length && (
            <Empty
              desc={
                items.length
                  ? "No known hosts match your search."
                  : "There is no known hosts yet."
              }
            />
          )}
        </>
      )}
    </Page>
  );
}
