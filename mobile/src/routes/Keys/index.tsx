import { get } from "lodash-es";
import { Button } from "@radix-ui/themes";
import { useCallback, useMemo, useRef, useState } from "react";
import { Dropdown, useKeys } from "shared";
import { deleteKey, type Key } from "tauri-plugin-data";
import { useIsShowPaywallAtom, useIsSubscription } from "@/atom/iap";
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
        <Dropdown menus={headerRightMenus}>
          {({ onChangeOpen }) => (
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
              onClick={(event) => onChangeOpen(event.currentTarget)}
            >
              <span className="icon-more" />
            </button>
          )}
        </Dropdown>
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
          <Dropdown menus={menus}>
            {({ onChangeOpen }) => (
              <div style={{ display: "flex", gap: 1 }}>
                <Button onClick={onAddKeyButtonClick}>
                  <span className="icon-add" />
                  Add key
                </Button>
                <Button
                  variant="soft"
                  onClick={(event) => onChangeOpen(event.currentTarget)}
                >
                  <span className="icon-more" />
                </Button>
              </div>
            )}
          </Dropdown>
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
                <Dropdown
                  menus={itemMenus}
                  anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                  }}
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                >
                  {({ onChangeOpen }) => (
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
                      onClick={(event) => {
                        selectedKeyRef.current = item;
                        onChangeOpen(event.currentTarget);
                      }}
                    >
                      <span className="icon-more" />
                    </button>
                  )}
                </Dropdown>
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
