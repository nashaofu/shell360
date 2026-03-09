import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Icon,
  IconButton,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import type { SSHSftpFile } from "tauri-plugin-ssh";

import useMessage from "@/hooks/useMessage";

type FileEditorModalProps = {
  open: boolean;
  file: SSHSftpFile | null;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  onLoadContent: () => Promise<string>;
};

export default function FileEditorModal({
  open,
  file,
  onClose,
  onSave,
  onLoadContent,
}: FileEditorModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const message = useMessage();

  useEffect(() => {
    if (open && file) {
      setLoading(true);
      onLoadContent()
        .then((fileContent) => {
          setContent(fileContent);
        })
        .catch((err) => {
          console.error("Failed to load file:", err);
          message.error({
            message: `Failed to load file: ${err?.message ?? JSON.stringify(err) ?? "Unknown error"}`,
          });
          onClose();
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, file, onLoadContent, onClose, message]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(content);
      message.success({
        message: "File saved successfully",
      });
      onClose();
    } catch (err: unknown) {
      message.error({
        message: `Failed to save file: ${(err as Error).message ?? "Unknown error"}`,
      });
    } finally {
      setSaving(false);
    }
  }, [content, onSave, onClose, message]);

  const handleCancel = useCallback(() => {
    setContent("");
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="lg"
      onClose={handleCancel}
      sx={{
        ".MuiDialog-paper": {
          height: "80vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
        }}
      >
        <Icon
          className="icon-file"
          sx={{
            mr: 1,
          }}
        />
        <Box sx={{ flex: 1 }}>Edit File: {file?.name}</Box>
        <IconButton
          size="small"
          edge="end"
          sx={{
            color: "inherit",
            ml: 2,
          }}
          disabled={loading || saving}
          onClick={handleCancel}
        >
          <Icon className="icon-close" fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          display: "flex",
          flexDirection: "column",
          p: 0,
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <TextField
            multiline
            fullWidth
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="File content..."
            disabled={saving}
            sx={{
              flex: 1,
              "& .MuiInputBase-root": {
                height: "100%",
                alignItems: "flex-start",
                fontFamily: "monospace",
                fontSize: "14px",
              },
              "& .MuiInputBase-input": {
                height: "100% !important",
                overflow: "auto !important",
              },
              "& fieldset": {
                border: "none",
              },
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={loading || saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || saving}
          variant="contained"
          color="primary"
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
