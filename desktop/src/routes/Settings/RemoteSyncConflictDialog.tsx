import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { type RemoteSnapshotMeta } from "shared";

interface RemoteSyncConflictDialogProps {
  open: boolean;
  latest?: Partial<RemoteSnapshotMeta> & {
    snapshotVersion: string;
  };
  onCancel: () => unknown;
  onRestoreRemote: () => unknown;
  onOverwriteRemote: () => unknown;
  loading?: boolean;
  summaryLines: string[];
}

export default function RemoteSyncConflictDialog({
  open,
  latest,
  onCancel,
  onRestoreRemote,
  onOverwriteRemote,
  loading = false,
  summaryLines,
}: RemoteSyncConflictDialogProps) {
  return (
    <Dialog open={open} onClose={() => onCancel()} fullWidth maxWidth="sm">
      <DialogTitle>Remote Snapshot Conflict</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The remote head changed before the upload completed. Choose whether to
          restore the latest remote snapshot locally or overwrite the current
          remote head with your local snapshot.
        </DialogContentText>
        <Box sx={{ mt: 2, whiteSpace: "pre-wrap" }}>
          {[
            latest?.snapshotVersion
              ? "Latest remote snapshot information:"
              : "Remote snapshot information is unavailable.",
            ...summaryLines,
          ].join("\n")}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          onClick={() => onCancel()}
          disabled={loading}
        >
          Later
        </Button>
        <Button
          variant="outlined"
          onClick={() => onRestoreRemote()}
          disabled={loading || !latest?.snapshotVersion}
        >
          Restore Remote Latest
        </Button>
        <Button
          variant="contained"
          onClick={() => onOverwriteRemote()}
          disabled={loading || !latest?.snapshotVersion}
        >
          Overwrite Remote
        </Button>
      </DialogActions>
    </Dialog>
  );
}
