import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import dayjs from "dayjs";
import { Loading, type RemoteSnapshotMeta } from "shared";

interface RemoteSyncHistoryProps {
  open: boolean;
  loading: boolean;
  loadingMore?: boolean;
  snapshots: RemoteSnapshotMeta[];
  total?: number;
  canLoadMore?: boolean;
  restoringSnapshotVersion?: string;
  onCancel: () => unknown;
  onRefresh: () => unknown;
  onLoadMore: () => unknown;
  onRestore: (snapshot: RemoteSnapshotMeta) => unknown;
}

export default function RemoteSyncHistory({
  open,
  loading,
  loadingMore = false,
  snapshots,
  total,
  canLoadMore = false,
  restoringSnapshotVersion,
  onCancel,
  onRefresh,
  onLoadMore,
  onRestore,
}: RemoteSyncHistoryProps) {
  const loadedCount = snapshots.length;

  return (
    <Dialog open={open} onClose={() => onCancel()} fullWidth maxWidth="sm">
      <DialogTitle>Remote Snapshot History</DialogTitle>
      <Loading loading={loading} size={32}>
        <DialogContent>
          <DialogContentText>
            Browse recent encrypted snapshots stored on the remote service and
            restore a specific version to local data.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1 }}>
            {total && total > 0
              ? `Loaded ${loadedCount} of ${total} snapshots.`
              : `Loaded ${loadedCount} snapshots.`}
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <List>
              {snapshots.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="No remote snapshots"
                    secondary="Upload a snapshot first, then refresh this history list."
                  />
                </ListItem>
              ) : (
                snapshots.map((snapshot) => {
                  const createdAt = snapshot.createdAt
                    ? dayjs(snapshot.createdAt).format("YYYY-MM-DD HH:mm:ss")
                    : "N/A";

                  return (
                    <ListItem
                      key={snapshot.snapshotVersion}
                      secondaryAction={
                        <IconButton
                          onClick={() => onRestore(snapshot)}
                          disabled={
                            loading ||
                            restoringSnapshotVersion ===
                              snapshot.snapshotVersion
                          }
                        >
                          <Icon className="icon-file-download" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={snapshot.snapshotVersion}
                        secondary={[
                          `Created At: ${createdAt}`,
                          `Device: ${snapshot.createdByDeviceId}`,
                          `Hosts: ${snapshot.recordCounts.hostCount}, Keys: ${snapshot.recordCounts.keyCount}, Port Forwardings: ${snapshot.recordCounts.portForwardingCount}`,
                        ].join("\n")}
                        slotProps={{
                          secondary: {
                            sx: {
                              whiteSpace: "pre-wrap",
                            },
                          },
                        }}
                      />
                    </ListItem>
                  );
                })
              )}
            </List>
          </Box>
          <DialogActions sx={{ px: 0, pt: 2 }}>
            <Button variant="outlined" onClick={() => onRefresh()}>
              Refresh
            </Button>
            <Button
              variant="outlined"
              onClick={() => onLoadMore()}
              disabled={loading || loadingMore || !canLoadMore}
            >
              {loadingMore ? "Loading..." : "Load More"}
            </Button>
            <Button variant="contained" onClick={() => onCancel()}>
              Close
            </Button>
          </DialogActions>
        </DialogContent>
      </Loading>
    </Dialog>
  );
}
