import type { Key } from "bridge/data";
import { Button, Flex } from "@radix-ui/themes";
import { ContentCopyIcon, DeleteIcon, EditIcon } from "shared";
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
      <Flex gap="1">
        <Button
          type="button"
          size="1"
          variant="ghost"
          onClick={() => onCopy(item)}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="1"
          variant="ghost"
          onClick={() => onEdit(item)}
        >
          Edit
        </Button>
        <Button
          type="button"
          size="1"
          variant="ghost"
          color="red"
          onClick={() => onDelete(item)}
        >
          Delete
        </Button>
      </Flex>
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
