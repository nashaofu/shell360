import { DropdownMenu } from "@radix-ui/themes";
import clsx from "clsx";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import {
  FileUploadIcon,
  getAvatarColor,
  getAvatarLabel,
  KeyIcon,
  LockIcon,
  MoreIcon,
  useKeys,
} from "shared";
import { addKey, deleteKey, type Key } from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import Empty from "@/components/Empty";
import GenerateKey from "@/components/GenerateKey";
import ListToolbar from "@/components/ListToolbar";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { useListView } from "@/hooks/useListView";
import useMessage from "@/hooks/useMessage";
import panel from "@/styles/panel.module.less";
import { filterByKeyword } from "@/utils/list";
import styles from "./index.module.less";
import KeyActions from "./KeyActions";

function getKeyTypeLabel(key: Key) {
  const type = key.publicKey.trim().split(/\s+/)[0] || "";
  switch (type) {
    case "ssh-ed25519":
    case "sk-ssh-ed25519@openssh.com":
      return "Ed25519";
    case "ssh-rsa":
    case "ssh-rsa-cert-v01@openssh.com":
      return "RSA";
    case "ecdsa-sha2-nistp256":
    case "ecdsa-sha2-nistp384":
    case "ecdsa-sha2-nistp521":
    case "sk-ecdsa-sha2-nistp256@openssh.com":
      return "ECDSA";
    default:
      return (
        type
          .replace(/^ssh-/, "")
          .replace(/^sk-/, "")
          .replace(/-cert.*$/, "")
          .toUpperCase() || "Key"
      );
  }
}

function getKeyPreview(publicKey: string) {
  const [, value = publicKey] = publicKey.trim().split(/\s+/);
  if (value.length <= 22) return value;
  return `${value.slice(0, 12)}...${value.slice(-7)}`;
}

export default function Keys() {
  const { keyword, setKeyword, viewMode, setViewMode } = useListView();
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);
  const [isOpenGenerateKey, setIsOpenGenerateKey] = useState(false);
  const [editKey, setEditKey] = useState<Key>();

  const confirmDelete = useConfirmDelete();
  const message = useMessage();
  const { data: keys = [], loading, refresh: refreshKeys } = useKeys();

  const items = useMemo(() => {
    return filterByKeyword(keys, keyword, [
      (item) => item.name,
      (item) => item.publicKey,
    ]);
  }, [keys, keyword]);

  const onAddKeyClose = useCallback(() => {
    setIsOpenAddKey(false);
    setEditKey(undefined);
  }, []);

  const onGenerateKeyClose = useCallback(() => {
    setIsOpenGenerateKey(false);
  }, []);

  const onEdit = useCallback((item: Key) => {
    setEditKey(item);
    setIsOpenAddKey(true);
  }, []);

  const onDelete = useCallback(
    (item: Key) => {
      confirmDelete({
        content: `Are you sure to delete the key: ${item.name}?`,
        onDelete: () => deleteKey(item),
        onSuccess: refreshKeys,
      });
    },
    [confirmDelete, refreshKeys],
  );

  const onCopyKey = useCallback(
    async (item: Key) => {
      try {
        const newKey = await addKey({
          ...omit(item, ["id"]),
          name: `${item.name} Copy`,
        });
        await refreshKeys();
        setEditKey(newKey);
        setIsOpenAddKey(true);
      } catch (err) {
        message.error({
          message: get(err, "message") || "Copy failed",
        });
      }
    },
    [message, refreshKeys],
  );

  return (
    <>
      <section className={panel.page}>
        <ListToolbar
          title="Keys"
          keyword={keyword}
          onKeywordChange={setKeyword}
          searchPlaceholder="Search keys..."
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        >
          <div className={panel.splitButton}>
            <button
              type="button"
              className={clsx(panel.button, panel.buttonPrimary)}
              onClick={() => setIsOpenGenerateKey(true)}
            >
              <KeyIcon width="11" height="11" />
              Generate Key
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button
                  type="button"
                  className={clsx(panel.button, panel.buttonPrimary)}
                  aria-label="More key options"
                >
                  <MoreIcon width="13" height="13" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="bottom" align="end" sideOffset={6}>
                <DropdownMenu.Item onSelect={() => setIsOpenGenerateKey(true)}>
                  <KeyIcon style={{ marginRight: 8 }} />
                  Generate Key
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => setIsOpenAddKey(true)}>
                  <FileUploadIcon style={{ marginRight: 8 }} />
                  Import Key
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </ListToolbar>
        <div className={panel.content}>
          {loading ? (
            <Empty desc="Loading keys..." />
          ) : items.length && viewMode === "grid" ? (
            <div className={styles.grid}>
              {items.map((item) => {
                const name = item.name;
                const avatarBg = getAvatarColor(name);
                const avatarLabel = getAvatarLabel(name);

                return (
                  <article key={item.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <div
                        className={styles.avatar}
                        style={{
                          background: `color-mix(in srgb, ${avatarBg} 14%, transparent)`,
                          color: avatarBg,
                        }}
                      >
                        {avatarLabel}
                      </div>
                      <div className={styles.cardInfo}>
                        <span className={styles.name}>{name}</span>
                        <span className={styles.fingerprint}>
                          {getKeyPreview(item.publicKey)}
                        </span>
                      </div>
                      <div className={styles.badges}>
                        <span className={styles.typeBadge}>
                          {getKeyTypeLabel(item)}
                        </span>
                        {item.passphrase && (
                          <span className={styles.protectedBadge}>
                            <LockIcon width="9" height="9" />
                          </span>
                        )}
                      </div>
                    </div>
                    {item.certificate && (
                      <div className={styles.certBadge}>Signed certificate</div>
                    )}
                    <KeyActions
                      item={item}
                      viewMode="grid"
                      onCopy={onCopyKey}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </article>
                );
              })}
            </div>
          ) : items.length ? (
            <div className={panel.tableWrap}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Private Key</th>
                    <th>Public Key</th>
                    <th>Passphrase</th>
                    <th>Certificate</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.listName}>{item.name}</td>
                      <td>
                        <span className={styles.typeBadge}>
                          {getKeyTypeLabel(item)}
                        </span>
                      </td>
                      <td>
                        {item.privateKey ? (
                          <span className={styles.stateBadge}>Configured</span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td className={styles.fingerprint}>
                        {getKeyPreview(item.publicKey)}
                      </td>
                      <td>
                        {item.passphrase ? (
                          <span className={styles.stateBadge}>
                            <LockIcon width="9" height="9" />
                            Set
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td>
                        {item.certificate ? (
                          <span className={styles.certBadge}>
                            Signed certificate
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td>
                        <KeyActions
                          item={item}
                          viewMode="list"
                          onCopy={onCopyKey}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty desc="There is no key yet, add it now.">
              <button
                type="button"
                className={panel.button}
                onClick={() => setIsOpenAddKey(true)}
              >
                <FileUploadIcon width="11" height="11" />
                Import Key
              </button>
              <button
                type="button"
                className={clsx(panel.button, panel.buttonPrimary)}
                onClick={() => setIsOpenGenerateKey(true)}
              >
                <KeyIcon width="11" height="11" />
                Generate Key
              </button>
            </Empty>
          )}
        </div>
      </section>

      <AddKey
        open={isOpenAddKey}
        data={editKey}
        onOk={onAddKeyClose}
        onCancel={onAddKeyClose}
      />

      <GenerateKey
        open={isOpenGenerateKey}
        onOk={onGenerateKeyClose}
        onCancel={onGenerateKeyClose}
      />
    </>
  );
}
