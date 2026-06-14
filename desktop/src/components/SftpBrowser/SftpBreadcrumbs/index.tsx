import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import { CloseIcon, EditIcon, SuccessCircleIcon } from "shared";
import styles from "./index.module.less";

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
        <div className={styles.editActions}>
          <button
            type="button"
            className={styles.confirmButton}
            title="Confirm"
            onClick={() => handleConfirmEdit()}
          >
            <SuccessCircleIcon />
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            title="Cancel"
            onClick={handleCancelEdit}
          >
            <CloseIcon />
          </button>
        </div>
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
        {dirs.map((item, index) => {
          const path = `/${dirs.slice(0, index + 1).join("/")}`;
          const isLast = index === dirs.length - 1;
          return (
            <div key={path} className={styles.breadcrumbNode}>
              {index > 0 && <span className={styles.separator}>/</span>}
              <button
                type="button"
                className={styles.breadcrumbItem}
                onClick={() => onClick(path)}
                tabIndex={isLast ? -1 : undefined}
              >
                {item}
              </button>
            </div>
          );
        })}
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
