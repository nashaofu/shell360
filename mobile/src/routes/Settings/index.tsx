import {
  Box,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useAtom } from 'jotai';

import Page from '@/components/Page';
import { ThemeMode, themeModeAtom } from '@/atom/themeAtom';
import useExportData from '@/hooks/useExportData';
import useImportData from '@/hooks/useImportData';
import useModal from '@/hooks/useModal';
import openUrl from '@/utils/openUrl';
import { useIsShowPaywallAtom, useIsSubscription } from '@/atom/iap';
import useMessage from '@/hooks/useMessage';

import CryptoSettings from './CryptoSettings';

function IOSIAP() {
  const [, setOpen] = useIsShowPaywallAtom();

  return (
    <Paper
      sx={{
        maxWidth: 560,
        my: 2,
        mx: 'auto',
      }}
    >
      <List>
        <ListItem>
          <ListItemText primary="Subscription" />
          <IconButton onClick={() => setOpen(true)}>
            <Icon className="icon-arrow-right" />
          </IconButton>
        </ListItem>
      </List>
    </Paper>
  );
}

export default function Settings() {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom);
  const [version, setVersion] = useState<string>();
  const exportData = useExportData();
  const importData = useImportData();
  const modal = useModal();
  const message = useMessage();
  const isSubscription = useIsSubscription();
  const [, setOpen] = useIsShowPaywallAtom();

  const onExportData = useCallback(async () => {
    // 没订阅时，不能导出
    if (!isSubscription) {
      setOpen(true);
      return;
    }

    try {
      const path = await exportData();
      if (!path) {
        return;
      }
      message.success({
        message: 'Export file successful',
      });
    } catch (err) {
      message.error({
        message: (
          <Box
            sx={{
              wordBreak: 'break-all',
            }}
          >
            Export failed:
            {` ${JSON.stringify(err)}`}
          </Box>
        ),
      });
    }
  }, [exportData, isSubscription, message, setOpen]);

  const onImportData = useCallback(async () => {
    // 没订阅时，不能导出
    if (!isSubscription) {
      setOpen(true);
      return;
    }

    await new Promise<void>((resolve) => {
      modal.confirm({
        title: 'Warning',
        icon: (
          <Icon
            color="warning"
            sx={{ fontSize: 32 }}
            className="icon-warning-circle"
          />
        ),
        content:
          'The import file will cover the same configuration, which may cause data loss, please do it carefully',
        onOk: () => resolve(),
      });
    });

    try {
      const isSuccess = await importData();
      if (!isSuccess) {
        return;
      }
      message.success({
        message: 'Import file successful',
      });
    } catch (err) {
      message.error({
        message: (
          <Box
            sx={{
              wordBreak: 'break-all',
            }}
          >
            Import failed:
            {` ${String(err)}`}
          </Box>
        ),
      });
    }
  }, [isSubscription, setOpen, modal, importData, message]);

  useEffect(() => {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }, []);

  return (
    <Page title="Settings">
      <Paper
        sx={{
          maxWidth: 560,
          my: 2,
          mx: 'auto',
        }}
      >
        <List>
          <ListItem>
            <ListItemText primary="Theme Mode" />
            <Select
              value={themeMode}
              size="small"
              inputProps={{
                sx: {
                  display: 'flex',
                  alignItems: 'center',
                  '.MuiListItemIcon-root': {
                    minWidth: 'unset',
                  },
                },
              }}
              onChange={(event) =>
                setThemeMode(event.target.value as ThemeMode)
              }
            >
              <MenuItem value={ThemeMode.Auto}>
                <ListItemIcon>
                  <Icon className="icon-settings-brightness" />
                </ListItemIcon>
                <ListItemText>Auto</ListItemText>
              </MenuItem>
              <MenuItem value={ThemeMode.Light}>
                <ListItemIcon>
                  <Icon className="icon-light-mode" />
                </ListItemIcon>
                <ListItemText>Light</ListItemText>
              </MenuItem>
              <MenuItem value={ThemeMode.Dark}>
                <ListItemIcon>
                  <Icon className="icon-dark-mode" />
                </ListItemIcon>
                <ListItemText>Dark</ListItemText>
              </MenuItem>
            </Select>
          </ListItem>
          <ListItem>
            <ListItemText primary="Export" />
            <IconButton onClick={onExportData}>
              <Icon className="icon-file-download" />
            </IconButton>
          </ListItem>

          <ListItem>
            <ListItemText primary="Import" />
            <IconButton onClick={onImportData}>
              <Icon className="icon-file-upload" />
            </IconButton>
          </ListItem>
        </List>
      </Paper>

      <Paper
        sx={{
          maxWidth: 560,
          my: 2,
          mx: 'auto',
        }}
      >
        <CryptoSettings />
      </Paper>

      <Paper
        sx={{
          maxWidth: 560,
          my: 2,
          mx: 'auto',
        }}
      >
        <List>
          <ListItem>
            <ListItemText primary="Privacy Policy" />
            <IconButton
              onClick={() =>
                openUrl(
                  'https://shell360.github.io/release/Privacy-Policy.html'
                )
              }
            >
              <Icon className="icon-arrow-right" />
            </IconButton>
          </ListItem>
          {__TAURI_PLATFORM__ === 'ios' && (
            <ListItem>
              <ListItemText primary="Terms of Use" />
              <IconButton
                onClick={() =>
                  openUrl(
                    'http://www.apple.com/legal/itunes/appstore/dev/stdeula'
                  )
                }
              >
                <Icon className="icon-arrow-right" />
              </IconButton>
            </ListItem>
          )}
          <ListItem>
            <ListItemText primary="About" />
            <IconButton
              onClick={() => openUrl('https://shell360.github.io/release/')}
            >
              <Icon className="icon-arrow-right" />
            </IconButton>
          </ListItem>
          <ListItem>
            <ListItemText primary="Version" />
            {version}
          </ListItem>
        </List>
      </Paper>

      {__TAURI_PLATFORM__ === 'ios' && <IOSIAP />}
    </Page>
  );
}
