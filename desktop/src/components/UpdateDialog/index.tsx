import { useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
} from '@mui/material';
import { relaunch } from '@tauri-apps/plugin-process';

import { useUpdateAtom } from '@/atom/updateAtom';

export default function UpdateDialog() {
  const {
    openUpdateDialog,
    setOpenUpdateDialog,
    isDownloading,
    error,
    total,
    downloaded,
    downloadAndInstall,
  } = useUpdateAtom();

  const progress = useMemo(() => {
    if (!total) {
      return 0;
    }

    return Math.min(Math.floor(((downloaded || 0) / total) * 100), 100);
  }, [total, downloaded]);

  const isDownloadSuccess = progress === 100 && !error;

  return (
    <Dialog open={openUpdateDialog} maxWidth="xs">
      <DialogTitle>New Version</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Find a new version, clicking on update will automatically upgrade.
          Please confirm to save all work before continuing
        </DialogContentText>
      </DialogContent>
      {(isDownloading || !!error) && (
        <Box
          sx={{
            flex: 1,
          }}
        >
          <LinearProgress
            variant="buffer"
            value={progress}
            valueBuffer={Math.min(progress + 10, 100)}
          />
        </Box>
      )}
      {!!error && (
        <Box
          sx={{
            pt: 0.5,
            px: 1,
            color: (theme) => theme.palette.error.main,
          }}
        >
          {String(error)}
        </Box>
      )}
      <DialogActions>
        <Button
          disabled={isDownloading}
          onClick={() => setOpenUpdateDialog(false)}
        >
          Cancel
        </Button>
        {!isDownloadSuccess && (
          <Button disabled={isDownloading} onClick={downloadAndInstall}>
            Update
          </Button>
        )}
        {isDownloadSuccess && <Button onClick={relaunch}>Relaunch</Button>}
      </DialogActions>
    </Dialog>
  );
}
