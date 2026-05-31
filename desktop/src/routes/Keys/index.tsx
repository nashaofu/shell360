import clsx from "clsx";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  ContentCopyIcon,
  DeleteIcon,
  EditIcon,
  FileUploadIcon,
  LockIcon,
  SearchIcon,
  useKeys,
} from "shared";
import { addKey, deleteKey, type Key } from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import Empty from "@/components/Empty";
import GenerateKey from "@/components/GenerateKey";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import panel from "@/styles/panel.module.less";
import styles from "./index.module.less";

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
  if (value.length <= 28) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

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

export default function Keys() {
  const [keyword, setKeyword] = useState("");
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);
  const [isOpenGenerateKey, setIsOpenGenerateKey] = useState(false);
  const [editKey, setEditKey] = useState<Key>();

  const modal = useModal();
  const message = useMessage();
  const { data: keys = [], loading, refresh: refreshKeys } = useKeys();

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return keys;
    return keys.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        item.publicKey?.toLowerCase().includes(kw),
    );
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
      modal.confirm({
        title: "Delete Confirmation",
        content: `Are you sure to delete the key: ${item.name}?`,
        OkButtonProps: {
          color: "orange",
        },
        onOk: async () => {
          try {
            await deleteKey(item);
          } catch (err) {
            message.error({
              message: get(err, "message") || "Deletion failed",
            });
            throw err;
          }
          refreshKeys();
        },
      });
    },
    [message, modal, refreshKeys],
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
        <div className={panel.toolbar}>
          <span className={panel.title}>Keys</span>
          <label className={panel.search}>
            <SearchIcon className={panel.searchIcon} />
            <input
              className={panel.searchInput}
              value={keyword}
              placeholder="Search keys..."
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={panel.button}
            onClick={() => setIsOpenAddKey(true)}
          >
            <FileUploadIcon width="11" height="11" />
            Add Key
          </button>
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenGenerateKey(true)}
          >
            <AddIcon width="11" height="11" />
            Generate Key
          </button>
        </div>
        <div className={panel.content}>
          {loading ? (
            <Empty desc="Loading keys..." />
          ) : items.length ? (
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
                    <div className={styles.cardFooter}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => onCopyKey(item)}
                      >
                        <ContentCopyIcon width="10" height="10" />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => onEdit(item)}
                      >
                        <EditIcon width="10" height="10" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => onDelete(item)}
                      >
                        <DeleteIcon width="10" height="10" />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty desc="There is no key yet, add it now.">
              <button
                type="button"
                className={panel.button}
                onClick={() => setIsOpenAddKey(true)}
              >
                <FileUploadIcon width="11" height="11" />
                Add Key
              </button>
              <button
                type="button"
                className={clsx(panel.button, panel.buttonPrimary)}
                onClick={() => setIsOpenGenerateKey(true)}
              >
                <AddIcon width="11" height="11" />
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
