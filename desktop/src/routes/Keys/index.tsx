import { get } from "lodash-es";
import { Button } from "@radix-ui/themes";
import { useCallback, useMemo, useRef, useState } from "react";
import { Dropdown, useKeys } from "shared";
import { deleteKey, type Key } from "tauri-plugin-data";
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
  const { data: keys = [], refresh: refreshKeys } = useKeys();

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

  const onGenerateKeyClose = useCallback(() => {
    setIsOpenGenerateKey(false);
  }, []);

  const menus = useMemo(
    () => [
      {
        label: "Generate key",
        value: "Generate key",
        onClick: () => setIsOpenGenerateKey(true),
      },
    ],
    [],
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
    [modal, refreshKeys, message],
  );

  return (
    <Page title="Keys">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "16px 0",
        }}
      >
        <div style={{ flexGrow: 1, maxWidth: 380, marginRight: 16 }}>
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
        <Dropdown menus={menus}>
          {({ onChangeOpen }) => (
            <div style={{ display: "flex", gap: 1 }}>
              <Button onClick={() => setIsOpenAddKey(true)}>
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
        onOk={onGenerateKeyClose}
        onCancel={onGenerateKeyClose}
      />
    </Page>
  );
}
