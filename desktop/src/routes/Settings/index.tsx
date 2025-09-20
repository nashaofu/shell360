import {
  Box,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useAtom } from 'jotai';

import Page from '@/components/Page';
import { ThemeMode, modeAtom } from '@/atom/themeAtom';
import { useUpdateAtom } from '@/atom/updateAtom';
import useExportData from '@/hooks/useExportData';
import useImportData from '@/hooks/useImportData';
import useModal from '@/hooks/useModal';
import openUrl from '@/utils/openUrl';
import useMessage from '@/hooks/useMessage';

import CryptoSettings from './CryptoSettings';

export default function Settings() {
  const [themeMode, setThemeMode] = useAtom(modeAtom);

  const { checkUpdate, setOpenUpdateDialog } = useUpdateAtom();
  const [version, setVersion] = useState<string>();
  const exportData = useExportData();
  const importData = useImportData();
  const modal = useModal();
  const message = useMessage();

  const onCheckUpdate = useCallback(async () => {
    const update = await checkUpdate();
    if (update?.available) {
      setOpenUpdateDialog(true);
    }
  }, [checkUpdate, setOpenUpdateDialog]);

  const onExportData = useCallback(async () => {
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
  }, [exportData, message]);

  const onImportData = useCallback(async () => {
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
  }, [importData, modal, message]);

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
            <ToggleButtonGroup
              value={themeMode}
              color="primary"
              exclusive
              size="small"
              onChange={(_, val) => setThemeMode(val)}
            >
              <ToggleButton value={ThemeMode.Auto}>
                <Icon className="icon-settings-brightness" />
                Auto
              </ToggleButton>
              <ToggleButton value={ThemeMode.Light}>
                <Icon className="icon-light-mode" />
                Light
              </ToggleButton>
              <ToggleButton value={ThemeMode.Dark}>
                <Icon className="icon-dark-mode" />
                Dark
              </ToggleButton>
            </ToggleButtonGroup>
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
            <ListItemText primary="Check Update" />
            <IconButton onClick={onCheckUpdate}>
              <Icon className="icon-arrow-right" />
            </IconButton>
          </ListItem>
          <ListItem>
            <ListItemText primary="Privacy Policy" />
            <IconButton
              onClick={() =>
                openUrl(
                  'https://nashaofu.github.io/shell360/docs/Privacy-Policy.html'
                )
              }
            >
              <Icon className="icon-arrow-right" />
            </IconButton>
          </ListItem>
          <ListItem>
            <ListItemText primary="About" />
            <IconButton
              onClick={() => openUrl('https://nashaofu.github.io/shell360/')}
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
    </Page>
  );
}
