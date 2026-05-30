import { Button, DropdownMenu } from "@radix-ui/themes";
import { get } from "lodash-es";
import { useCallback, useMemo, useRef, useState } from "react";
import { useKeys } from "shared";
import { deleteKey, type Key } from "tauri-plugin-data";
import { useIsShowPaywallAtom, useIsSubscription } from "@/atoms/iap.atom";
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
  const selectedKeyRef = useRef<Key>(null);
  const [isOpenAddKey, setIsOpenAddKey] = useState(false);
  const [isOpenGenerateKey, setIsOpenGenerateKey] = useState(false);
  const [editKey, setEditKey] = useState<Key>();

  const modal = useModal();
  const message = useMessage();
  const { data: keys, refresh: refreshKeys } = useKeys();

  const isSubscription = useIsSubscription();
  const [, setOpen] = useIsShowPaywallAtom();

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
    // 没订阅时，最多只能创�?个key
    if (!isSubscription && keys.length >= 1) {
      setOpen(true);
      return;
    }
    setIsOpenAddKey(true);
  }, [isSubscription, keys.length, setOpen]);

  const onGenerateKeyButtonClick = useCallback(() => {
    // 没订阅时，最多只能创�?个key
    if (!isSubscription && keys.length >= 1) {
      setOpen(true);
      return;
    }
    setIsOpenGenerateKey(true);
  }, [isSubscription, keys.length, setOpen]);

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

  const itemMenus = useMemo(
    () => [
      {
        label: (
          <>
            <span className="icon-edit" style={{ marginRight: 8 }} />
            Edit
          </>
        ),
        value: "Edit",
        onClick: () => {
          setIsOpenAddKey(true);
          setEditKey(selectedKeyRef.current || undefined);
          selectedKeyRef.current = null;
        },
      },
      {
        label: (
          <>
            <span className="icon-delete" style={{ marginRight: 8 }} />
            Delete
          </>
        ),
        value: "Delete",
        onClick: () => {
          const selectedKey = selectedKeyRef.current;
          selectedKeyRef.current = null;
          if (!selectedKey) {
            return;
          }
          const deleteKeyName = selectedKey.name;

          modal.confirm({
            title: "Delete Confirmation",
            content: `Are you sure to delete the key: ${deleteKeyName}?`,
            OkButtonProps: {
              color: "orange",
            },
            onOk: async () => {
              try {
                await deleteKey(selectedKey);
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
      },
    ],
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
              <span className="icon-more" />
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "16px 0",
        }}
      >
        <div style={{ maxWidth: 600, flexGrow: 1 }}>
          <input
            className="rt-reset rt-TextFieldInput"
            value={keyword}
            style={{
              width: "100%",
              paddingLeft: 8,
              paddingRight: 8,
              height: 36,
            }}
            placeholder="Search..."
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div style={{ marginLeft: 16 }}>
          <div style={{ display: "flex", gap: 1 }}>
            <Button onClick={onAddKeyButtonClick}>
              <span className="icon-add" />
              Add key
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="soft">
                  <span className="icon-more" />
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
            icon={<span className="icon-key" />}
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
                      onClick={() => {
                        selectedKeyRef.current = item;
                      }}
                    >
                      <span className="icon-more" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    {itemMenus.map((menuItem) => (
                      <DropdownMenu.Item
                        key={menuItem.value}
                        onSelect={() => menuItem.onClick?.()}
                      >
                        {menuItem.label}
                      </DropdownMenu.Item>
                    ))}
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
