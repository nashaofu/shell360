import clsx from "clsx";
import { get } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import { useKeys } from "shared";
import { deleteKey, type Key } from "tauri-plugin-data";
import AddKey from "@/components/AddKey";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import { copy } from "@/utils/clipboard";
import Empty from "@/components/Empty";
import panel from "@/styles/panel.module.less";

import GenerateKey from "@/components/GenerateKey";
import styles from "./index.module.less";

function getKeyTypeLabel(key: Key) {
  const type = key.publicKey.trim().split(/\s+/)[0] || "";

  switch (type) {
    case "ssh-ed25519":
      return "Ed25519";
    case "ssh-rsa":
      return "RSA";
    case "ecdsa-sha2-nistp256":
      return "ECDSA";
    default:
      return type.replace(/^ssh-/, "").toUpperCase() || "Key";
  }
}

function getKeyPreview(publicKey: string) {
  const [, value = publicKey] = publicKey.trim().split(/\s+/);
  if (value.length <= 28) {
    return value;
  }
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

export default function Keys() {
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);
  const [isOpenGenerateKey, setIsOpenGenerateKey] = useState(false);
  const [editKey, setEditKey] = useState<Key>();

  const modal = useModal();
  const message = useMessage();
  const { data: keys = [], refresh: refreshKeys } = useKeys();

  const items = useMemo(() => keys, [keys]);

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

  const onCopyPublicKey = useCallback(
    (item: Key) => {
      copy(item.publicKey);
      message.success({ message: `Copied ${item.name} public key` });
    },
    [message],
  );

  return (
    <>
      <section className={panel.page}>
        <div className={panel.toolbar}>
          <span className={panel.title}>SSH Keys</span>
          <button
            type="button"
            className={panel.button}
            onClick={() => setIsOpenAddKey(true)}
          >
            Import
          </button>
          <button
            type="button"
            className={clsx(panel.button, panel.buttonPrimary)}
            onClick={() => setIsOpenGenerateKey(true)}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Generate Key
          </button>
        </div>
        <div className={panel.content}>
          {items.length ? (
            <div className={styles.grid}>
              {items.map((item, index) => (
                <article key={item.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.typeBadge}>{getKeyTypeLabel(item)}</span>
                    <div className={styles.name}>{item.name}</div>
                    {(index === 0 || item.passphrase) && (
                      <span className={styles.stateBadge}>
                        {index === 0 ? "Default" : "Protected"}
                      </span>
                    )}
                  </div>
                  <div className={styles.preview}>{getKeyPreview(item.publicKey)}</div>
                  <div className={styles.meta}>
                    <span>{item.certificate ? "Certificate attached" : "Public key ready"}</span>
                    <span
                      className={
                        item.passphrase ? styles.metaActive : styles.metaIdle
                      }
                    >
                      {item.passphrase ? "Active" : "Unused"}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={panel.actionButton}
                      onClick={() => onCopyPublicKey(item)}
                    >
                      Copy public key
                    </button>
                    <button
                      type="button"
                      className={panel.actionButton}
                      onClick={() => onEdit(item)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={clsx(panel.actionButton, panel.dangerButton)}
                      onClick={() => onDelete(item)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty desc="There is no key yet, add it now.">
              <button
                type="button"
                className={clsx(panel.button, panel.buttonPrimary)}
                onClick={() => setIsOpenAddKey(true)}
              >
                Import
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
