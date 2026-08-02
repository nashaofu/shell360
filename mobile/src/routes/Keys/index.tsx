import { DropdownMenu } from "@radix-ui/themes";
import { deleteKey, type Key } from "bridge/data";
import { get } from "lodash-es";
import { useCallback, useMemo, useState } from "react";
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  KeyIcon,
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

export default function Keys() {
  const [keyword, setKeyword] = useState("");
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);
  const [isOpenGenerateKey, setIsOpenGenerateKey] = useState(false);
  const [editKey, setEditKey] = useState<Key>();

  const modal = useModal();
  const message = useMessage();
  const { data: keys, refresh: refreshKeys } = useKeys();

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    if (!kw) {
      return keys;
    }
    return keys.filter((item) => item.name.toLowerCase().includes(kw));
  }, [keys, keyword]);

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
          <DropdownMenu.Item onSelect={() => onDeleteKey(key)}>
            <DeleteIcon style={{ marginRight: 8 }} />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    ),
    [onDeleteKey],
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
      />

      {items.map((item) => (
        <div className="key-list-item" key={item.id}>
          <ItemCard
            icon={<KeyIcon />}
            title={item.name}
            desc={item.publicKey ? item.publicKey.slice(0, 32) : undefined}
            extra={
              <span onClick={(event) => event.stopPropagation()}>
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
            onClick={() => setKeyword("")}
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
