import { useCallback, useEffect, useState } from "react";
import type { SSHSftpFile } from "tauri-plugin-ssh";

import useMessage from "@/hooks/useMessage";
import styles from "./FileEditorModal.module.less";

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
    if (!open || !file) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    onLoadContent()
      .then((fileContent) => {
        if (cancelled) { return; }
        setContent(fileContent);
      })
      .catch((err) => {
        if (cancelled) { return; }
        console.error("Failed to load file:", err);
        message.error({
          message: `Failed to load file: ${err?.message ?? JSON.stringify(err) ?? "Unknown error"}`,
        });
        onClose();
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); }
      });
    return () => {
      cancelled = true;
    };
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

  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className="icon-file" />
          <div className={styles.title}>Edit File: {file?.name}</div>
          <button
            type="button"
            className={styles.iconButton}
            disabled={loading || saving}
            onClick={handleCancel}
          >
            <span className="icon-close" />
          </button>
        </div>
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingWrap}>Loading...</div>
          ) : (
            <textarea
              className={styles.editor}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="File content..."
              disabled={saving}
            />
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleCancel}
            disabled={loading || saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
