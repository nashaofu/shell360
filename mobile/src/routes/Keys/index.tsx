import { useCallback, useMemo, useState } from 'react';
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
import { useKeys } from 'shared';
import { deleteKey, Key } from 'tauri-plugin-data';
import { get } from 'lodash-es';

import Empty from '@/components/Empty';
import AddKey from '@/components/AddKey';
import ItemCard from '@/components/ItemCard';
import Page from '@/components/Page';
import AutoRepeatGrid from '@/components/AutoRepeatGrid';
import Dropdown from '@/components/Dropdown';
import useModal from '@/hooks/useModal';
import { useIsShowPaywallAtom, useIsSubscription } from '@/atom/iap';
import useMessage from '@/hooks/useMessage';

import GenerateKey from './GenerateKey';

export default function Keys() {
  const [keyword, setKeyword] = useState('');
  const [selectedKey, setSelectedKey] = useState<Key>();
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
    // 没订阅时，最多只能创建1个key
    if (!isSubscription && keys.length >= 1) {
      setOpen(true);
      return;
    }
    setIsOpenAddKey(true);
  }, [isSubscription, keys.length, setOpen]);

  const onGenerateKeyButtonClick = useCallback(() => {
    // 没订阅时，最多只能创建1个key
    if (!isSubscription && keys.length >= 1) {
      setOpen(true);
      return;
    }
    setIsOpenGenerateKey(true);
  }, [isSubscription, keys.length, setOpen]);

  const menus = useMemo(
    () => [
      {
        label: 'Generate key',
        value: 'Generate key',
        onClick: () => onGenerateKeyButtonClick(),
      },
    ],
    [onGenerateKeyButtonClick]
  );

  const headerRightMenus = useMemo(
    () => [
      {
        label: 'Add key',
        value: 'Add key',
        onClick: () => onAddKeyButtonClick(),
      },
      {
        label: 'Generate key',
        value: 'Generate key',
        onClick: () => onGenerateKeyButtonClick(),
      },
    ],
    [onAddKeyButtonClick, onGenerateKeyButtonClick]
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
          setEditKey(selectedKey);
          setSelectedKey(undefined);
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
          setSelectedKey(undefined);
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
                if (get(err, 'type') === 'DeleteForeignKeyError') {
                  message.error({
                    message:
                      'Deletion failed, other items are still using the current key',
                  });
                }
                throw err;
              }

              refreshKeys();
            },
          });
        },
      },
    ],
    [message, modal, refreshKeys, selectedKey]
  );

  return (
    <Page
      title="Keys"
      headerRight={
        <Dropdown menus={headerRightMenus}>
          {({ onChangeOpen }) => (
            <IconButton
              sx={(theme) => ({
                ml: 2,
                color: 'inherit',
                [theme.breakpoints.up('sm')]: {
                  display: 'none',
                },
              })}
              edge="end"
              size="small"
              onClick={(event) => onChangeOpen(event.currentTarget)}
            >
              <Icon className="icon-more" />
            </IconButton>
          )}
        </Dropdown>
      }
    >
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
            maxWidth: 600,
            flexGrow: 1,
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
        <Box
          sx={(theme) => ({
            ml: 2,
            [theme.breakpoints.down('sm')]: {
              display: 'none',
            },
          })}
        >
          <Dropdown menus={menus}>
            {({ onChangeOpen }) => (
              <ButtonGroup variant="contained">
                <Button
                  startIcon={<Icon className="icon-add" />}
                  onClick={onAddKeyButtonClick}
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
              <Box onClick={(event) => event.stopPropagation()}>
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
                        setSelectedKey(item);
                        onChangeOpen(event.currentTarget);
                      }}
                    >
                      <Icon className="icon-more" />
                    </IconButton>
                  )}
                </Dropdown>
              </Box>
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
        onOk={() => setIsOpenGenerateKey(false)}
        onCancel={() => setIsOpenGenerateKey(false)}
      />
    </Page>
  );
}
