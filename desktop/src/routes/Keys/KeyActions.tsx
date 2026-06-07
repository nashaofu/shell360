import clsx from "clsx";
import { ContentCopyIcon, DeleteIcon, EditIcon } from "shared";
import type { Key } from "tauri-plugin-data";
import panel from "@/styles/panel.module.less";
import styles from "./index.module.less";

type KeyActionsProps = {
  item: Key;
  viewMode: "grid" | "list";
  onCopy: (item: Key) => void;
  onDelete: (item: Key) => void;
  onEdit: (item: Key) => void;
};

export default function KeyActions({
  item,
  viewMode,
  onCopy,
  onDelete,
  onEdit,
}: KeyActionsProps) {
  if (viewMode === "list") {
    return (
      <div className={panel.actionGroup}>
        <button
          type="button"
          className={panel.actionButton}
          onClick={() => onCopy(item)}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={panel.actionButton}
          onClick={() => onEdit(item)}
        >
          Edit
        </button>
        <button
          type="button"
          className={clsx(panel.actionButton, panel.dangerButton)}
          onClick={() => onDelete(item)}
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className={styles.cardFooter}>
      <button
        type="button"
        className={styles.primaryBtn}
        onClick={() => onCopy(item)}
      >
        <ContentCopyIcon width="10" height="10" />
        Duplicate
      </button>
      <button
        type="button"
        className={styles.primaryBtn}
        onClick={() => onEdit(item)}
      >
        <EditIcon width="10" height="10" />
        Edit
      </button>
      <button
        type="button"
        className={styles.dangerBtn}
        onClick={() => onDelete(item)}
      >
        <DeleteIcon width="10" height="10" />
        Delete
      </button>
    </div>
  );
}
