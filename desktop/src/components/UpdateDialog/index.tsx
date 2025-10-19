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

import { useUpdateAtom } from '@/atom/updateAtom';

export default function UpdateDialog() {
  const {
    openUpdateDialog,
    setOpenUpdateDialog,
    isDownloading,
    error,
    total,
    downloaded,
    download,
    install,
  } = useUpdateAtom();

  const progress = useMemo(() => {
    if (!total) {
      return 0;
    }

    return Math.min(Math.floor(((downloaded || 0) / total) * 100), 100);
  }, [total, downloaded]);

  const isDownloadSuccess = progress === 100 && !error;

  return (
    <Dialog open={openUpdateDialog}>
      <DialogTitle>
        {isDownloadSuccess ? '🎉 Update Ready' : '🚀 New Version Available'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {isDownloadSuccess ? (
            <Box>
              The update has been downloaded successfully.
              <br />
              Click <b>“Install”</b> to apply the new version.
            </Box>
          ) : (
            <Box>
              A new version of the application is available.
              <br />
              Click <b>“Download”</b> to start the update process.
            </Box>
          )}
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
        {isDownloadSuccess ? (
          <Button onClick={install}>Install</Button>
        ) : (
          <Button disabled={isDownloading} onClick={download}>
            Download
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
