import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import AutoRepeatGrid from "@/components/AutoRepeatGrid";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
import useModal from "@/hooks/useModal";
import styles from "./index.module.less";

async function readKnownHost() {
  const data = await readTextFile("./known_hosts", {
    baseDir: BaseDirectory.AppData,
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

export default function KnownHosts() {
  const [items, setItems] = useState<KnownHost[]>([]);
  const modal = useModal();

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
          const knownHosts = await readKnownHost();

          const newItems = knownHosts.filter(
            (item) => item.id !== knownHost.id,
          );
          const data = newItems
            .map((item) => `${item.host} ${item.type} ${item.key}`)
            .join("\r\n");

          await writeTextFile("./known_hosts", data, {
            baseDir: BaseDirectory.AppData,
          });

          setItems(newItems);
        },
      });
    },
    [modal],
  );

  useEffect(() => {
    readKnownHost().then((knownHosts) => setItems(knownHosts));
  }, []);

  return (
    <Page title="Known hosts">
      <AutoRepeatGrid
        sx={{
          gap: 2,
          mt: 2,
        }}
        itemWidth={280}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            icon={<span className="icon-fingerprint" />}
            title={item.host}
            desc={item.type}
            extra={
              <button
                type="button"
                className={styles.deleteButton}
                onClick={(event) => onDelete(event, item)}
              >
                <span className="icon-delete" />
              </button>
            }
          />
        ))}
      </AutoRepeatGrid>
      {!items.length && <Empty desc="There is no known hosts yet." />}
    </Page>
  );
}
