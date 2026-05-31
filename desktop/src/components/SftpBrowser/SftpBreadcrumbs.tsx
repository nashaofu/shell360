import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import { CloseIcon, EditIcon, SuccessCircleIcon } from "shared";
import styles from "./SftpBreadcrumbs.module.less";

type SftpBreadcrumbsProps = {
  dirname?: string;
  onClick: (dir: string) => unknown;
  onNavigate?: (path: string) => Promise<boolean>;
};

export default function SftpBreadcrumbs({
  dirname = "/",
  onClick,
  onNavigate,
}: SftpBreadcrumbsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPath, setEditPath] = useState(dirname);

  const dirs = useMemo(() => {
    return dirname.split("/").filter((item) => !!item.length);
  }, [dirname]);

  const handleStartEdit = useCallback(() => {
    setEditPath(dirname);
    setIsEditing(true);
  }, [dirname]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditPath(dirname);
  }, [dirname]);

  const handleConfirmEdit = useCallback(async () => {
    if (!onNavigate) {
      onClick(editPath);
      setIsEditing(false);
      return;
    }

    // Normalize path
    let normalizedPath = editPath.trim();
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }

    const success = await onNavigate(normalizedPath);
    if (success) {
      setIsEditing(false);
    }
  }, [editPath, onClick, onNavigate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleConfirmEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleConfirmEdit, handleCancelEdit],
  );

  const items = dirs.map((item, index) => {
    const path = `/${dirs.slice(0, index + 1).join("/")}`;
    if (index < dirs.length - 1) {
      return (
        <button
          type="button"
          // biome-ignore lint/suspicious/noArrayIndexKey: 路径中的部分可能存在重复，但路径整体是唯一�?          key={item + index}
          className={styles.breadcrumbItem}
          onClick={() => onClick(path)}
        >
          {item}
        </button>
      );
    } else {
      return (
        <button
          type="button"
          // biome-ignore lint/suspicious/noArrayIndexKey: 路径中的部分可能存在重复，但路径整体是唯一�?          key={item + index}
          className={styles.breadcrumbItem}
          onClick={() => onClick(path)}
        >
          {item}
        </button>
      );
    }
  });

  if (isEditing) {
    return (
      <div className={styles.editRoot}>
        <input
          className={styles.editInput}
          value={editPath}
          onChange={(e) => setEditPath(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Enter path..."
        />
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => handleConfirmEdit()}
        >
          <SuccessCircleIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={handleCancelEdit}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.rootButton}
        onClick={() => onClick("/")}
      >
        /
      </button>
      <div className={styles.breadcrumbs} onDoubleClick={handleStartEdit}>
        {items.map((item, index) => (
          <div key={index} className={styles.breadcrumbNode}>
            {index > 0 && <span className={styles.separator}>/</span>}
            {item}
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.iconButton}
        onClick={handleStartEdit}
      >
        <EditIcon />
      </button>
    </div>
  );
}
