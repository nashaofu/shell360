import { Button, DropdownMenu } from "@radix-ui/themes";
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
import AutoRepeatGrid from "@/components/AutoRepeatGrid";
import Empty from "@/components/Empty";
import ItemCard from "@/components/ItemCard";
import Page from "@/components/Page";
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

  const menus = useMemo(
    () => [
      {
        label: "Generate key",
        value: "Generate key",
        onClick: () => onGenerateKeyButtonClick(),
      },
    ],
    [onGenerateKeyButtonClick],
  );

  const headerRightMenus = useMemo(
    () => [
      {
        label: "Add key",
        value: "Add key",
        onClick: () => onAddKeyButtonClick(),
      },
      {
        label: "Generate key",
        value: "Generate key",
        onClick: () => onGenerateKeyButtonClick(),
      },
    ],
    [onAddKeyButtonClick, onGenerateKeyButtonClick],
  );

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

  return (
    <Page
      title="Keys"
      headerRight={
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button
              type="button"
              style={{
                marginLeft: 8,
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <MoreIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
            {headerRightMenus.map((item) => (
              <DropdownMenu.Item
                key={item.value}
                onSelect={() => item.onClick?.()}
              >
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      <div className="mobile-toolbar">
        <div style={{ flexGrow: 1 }}>
          <input
            className="mobile-search"
            value={keyword}
            placeholder="Search keys"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div>
          <div style={{ display: "flex", gap: 1 }}>
            <Button onClick={onAddKeyButtonClick}>
              <AddIcon />
              Add
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="soft">
                  <MoreIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
                {menus.map((item) => (
                  <DropdownMenu.Item
                    key={item.value}
                    onSelect={() => item.onClick?.()}
                  >
                    {item.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>
      <AutoRepeatGrid
        sx={{
          gap: 2,
        }}
        itemWidth={280}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            icon={<KeyIcon />}
            title={item.name}
            extra={
              <div onClick={(event) => event.stopPropagation()}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "inherit",
                        padding: 4,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <MoreIcon />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenu.Item
                      onSelect={() => {
                        setEditKey(item);
                        setIsOpenAddKey(true);
                      }}
                    >
                      <EditIcon style={{ marginRight: 8 }} />
                      Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => onDeleteKey(item)}>
                      <DeleteIcon style={{ marginRight: 8 }} />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
            }
          />
        ))}
      </AutoRepeatGrid>
      {!items.length && (
        <Empty desc="There is no key yet, add it now.">
          <Button onClick={() => setIsOpenAddKey(true)}>Add key</Button>
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
