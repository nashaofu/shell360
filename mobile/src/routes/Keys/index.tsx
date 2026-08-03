import { DropdownMenu } from "@radix-ui/themes";
import { addKey, deleteKey, type Key } from "bridge/data";
import { get, omit } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  ArrowDownIcon,
  ContentCopyIcon,
  DeleteIcon,
  EditIcon,
  KeyIcon,
  LockIcon,
  MoreIcon,
  useKeys,
} from "shared";
import AddKey from "@/components/AddKey";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
import SearchToolbar from "@/components/SearchToolbar";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import GenerateKey from "./GenerateKey";
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
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-7)}`;
}

const TYPE_OPTIONS = ["Ed25519", "RSA", "ECDSA"];

export default function Keys() {
  const [keyword, setKeyword] = useState("");
  const [selectedType, setSelectedType] = useState<string>();
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);
  const [isOpenGenerateKey, setIsOpenGenerateKey] = useState(false);
  const [editKey, setEditKey] = useState<Key>();

  const modal = useModal();
  const message = useMessage();
  const { data: keys, refresh: refreshKeys } = useKeys();

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return keys.filter((item) => {
      if (selectedType && getKeyTypeLabel(item) !== selectedType) {
        return false;
      }
      if (!kw) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(kw) ||
        item.publicKey.toLowerCase().includes(kw)
      );
    });
  }, [keys, keyword, selectedType]);

  const onAddKeyClose = useCallback(() => {
    setIsOpenAddKey(false);
    setEditKey(undefined);
  }, []);

  const onAddKeyButtonClick = useCallback(() => {
    setIsOpenAddKey(true);
  }, []);

  const onGenerateKeyButtonClick = useCallback(() => {
    setIsOpenGenerateKey(true);
  }, []);

  const onDeleteKey = useCallback(
    (key: Key) => {
      modal.confirm({
        title: "Delete Confirmation",
        content: `Are you sure to delete the key: ${key.name}?`,
        OkButtonProps: {
          color: "orange",
        },
        onOk: async () => {
          try {
            await deleteKey(key);
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
    async (key: Key) => {
      try {
        const newKey = await addKey({
          ...omit(key, ["id"]),
          name: `${key.name} Copy`,
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

  const moreActions = useCallback(
    (key: Key) => (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <button
            type="button"
            className="card-more-btn"
            aria-label={`More actions for ${key.name}`}
          >
            <MoreIcon />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
          <DropdownMenu.Item
            onSelect={() => {
              setEditKey(key);
              setIsOpenAddKey(true);
            }}
          >
            <EditIcon style={{ marginRight: 8 }} />
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => onCopyKey(key)}>
            <ContentCopyIcon style={{ marginRight: 8 }} />
            Duplicate
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => onDeleteKey(key)}>
            <DeleteIcon style={{ marginRight: 8 }} />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    ),
    [onCopyKey, onDeleteKey],
  );

  const typeFilterTrigger = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <button
          type="button"
          className="toolbar-filter-trigger"
          data-active={!!selectedType}
        >
          <KeyIcon aria-hidden="true" />
          {selectedType ?? "All types"}
          <ArrowDownIcon aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
        <DropdownMenu.Item onSelect={() => setSelectedType(undefined)}>
          All types
        </DropdownMenu.Item>
        {TYPE_OPTIONS.map((type) => (
          <DropdownMenu.Item key={type} onSelect={() => setSelectedType(type)}>
            {type}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );

  return (
    <Page
      title="Keys"
      headerRight={
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button
              type="button"
              className="mobile-icon-btn"
              aria-label="Generate or import key"
            >
              <AddIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
            <DropdownMenu.Item onSelect={onGenerateKeyButtonClick}>
              Generate key
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onAddKeyButtonClick}>
              Import key
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      <SearchToolbar
        value={keyword}
        placeholder="Search keys"
        onChange={setKeyword}
        activeFilterCount={selectedType ? 1 : 0}
        filterTrigger={typeFilterTrigger}
      />

      {items.map((item) => (
        <div className="key-list-item" key={item.id}>
          <ItemCard
            icon={<KeyIcon />}
            title={
              <span className={styles.nameWrap}>
                {item.name}
                {item.passphrase && (
                  <LockIcon className={styles.lockIcon} aria-hidden="true" />
                )}
              </span>
            }
            desc={
              <span className="mobile-monospace">
                SHA256:{getKeyPreview(item.publicKey)}
              </span>
            }
            extra={
              <span
                className={styles.extraWrap}
                onClick={(event) => event.stopPropagation()}
              >
                <span className={styles.typeBadge}>
                  {getKeyTypeLabel(item)}
                </span>
                {moreActions(item)}
              </span>
            }
          />
        </div>
      ))}

      {!keys.length && (
        <Empty desc="There is no key yet, add it now.">
          <button
            type="button"
            className="mobile-primary"
            onClick={onAddKeyButtonClick}
          >
            <AddIcon />
            New key
          </button>
        </Empty>
      )}

      {!!keys.length && !items.length && (
        <Empty desc="No keys match your search.">
          <button
            type="button"
            className="mobile-secondary"
            onClick={() => {
              setKeyword("");
              setSelectedType(undefined);
            }}
          >
            Clear search
          </button>
        </Empty>
      )}

      <AddKey
        open={isOpenAddKey}
        data={editKey}
        onOk={onAddKeyClose}
        onCancel={onAddKeyClose}
      />

      <GenerateKey
        open={isOpenGenerateKey}
        onOk={() => setIsOpenGenerateKey(false)}
        onCancel={() => setIsOpenGenerateKey(false)}
      />
    </Page>
  );
}
