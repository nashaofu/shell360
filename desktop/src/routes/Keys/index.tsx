import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  ButtonGroup,
  Icon,
  OutlinedInput,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useKeys, Dropdown } from 'shared';
import { deleteKey, type Key } from 'tauri-plugin-data';
import { get } from 'lodash-es';

import Empty from '@/components/Empty';
import AddKey from '@/components/AddKey';
import ItemCard from '@/components/ItemCard';
import Page from '@/components/Page';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import useModal from '@/hooks/useModal';
import useMessage from '@/hooks/useMessage';

import GenerateKey from './GenerateKey';

export default function Keys() {
  const [keyword, setKeyword] = useState('');
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
        label: 'Generate key',
        value: 'Generate key',
        onClick: () => setIsOpenGenerateKey(true),
      },
    ],
    []
  );

  const itemMenus = useMemo(
    () => [
      {
        label: (
          <>
            <ListItemIcon>
              <Icon className="icon-edit" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </>
        ),
        value: 'Edit',
        onClick: () => {
          setIsOpenAddKey(true);
          setEditKey(selectedKeyRef.current || undefined);
          selectedKeyRef.current = null;
        },
      },
      {
        label: (
          <>
            <ListItemIcon>
              <Icon className="icon-delete" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </>
        ),
        value: 'Delete',
        onClick: () => {
          const selectedKey = selectedKeyRef.current;
          selectedKeyRef.current = null;

          if (!selectedKey) {
            return;
          }
          const deleteKeyName = selectedKey.name;

          modal.confirm({
            title: 'Delete Confirmation',
            content: `Are you sure to delete the key: ${deleteKeyName}?`,
            OkButtonProps: {
              color: 'warning',
            },
            onOk: async () => {
              try {
                await deleteKey(selectedKey);
              } catch (err) {
                message.error({
                  message: get(err, 'message') || 'Deletion failed',
                });
                throw err;
              }

              refreshKeys();
            },
          });
        },
      },
    ],
    [modal, refreshKeys, message, selectedKeyRef]
  );

  return (
    <Page title="Keys">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          my: 2,
        }}
      >
        <Box
          sx={{
            flexGrow: 1,
            maxWidth: 380,
            mr: 2,
          }}
        >
          <OutlinedInput
            value={keyword}
            fullWidth
            size="small"
            startAdornment={<Icon className="icon-search" />}
            placeholder="Search..."
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Box>
        <Dropdown menus={menus}>
          {({ onChangeOpen }) => (
            <ButtonGroup
              variant="contained"
              sx={{
                height: 40,
              }}
            >
              <Button
                startIcon={<Icon className="icon-add" />}
                onClick={() => setIsOpenAddKey(true)}
              >
                Add key
              </Button>
              <Button
                size="small"
                onClick={(event) => onChangeOpen(event.currentTarget)}
              >
                <Icon className="icon-more" />
              </Button>
            </ButtonGroup>
          )}
        </Dropdown>
      </Box>
      <AutoRepeatGrid
        sx={{
          gap: 2,
        }}
        itemWidth={280}
      >
        {items.map((item) => (
          <ItemCard
            key={item.id}
            icon={<Icon className="icon-key" />}
            title={item.name}
            extra={
              <Dropdown
                menus={itemMenus}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                {({ onChangeOpen }) => (
                  <IconButton
                    onClick={(event) => {
                      selectedKeyRef.current = item;
                      onChangeOpen(event.currentTarget);
                    }}
                  >
                    <Icon className="icon-more" />
                  </IconButton>
                )}
              </Dropdown>
            }
          />
        ))}
      </AutoRepeatGrid>
      {!items.length && (
        <Empty desc="There is no key yet, add it now.">
          <Button variant="contained" onClick={() => setIsOpenAddKey(true)}>
            Add key
          </Button>
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
