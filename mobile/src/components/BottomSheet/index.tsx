import type { ReactNode } from "react";
import { useEffect } from "react";
import ThemedPortal from "@/components/ThemedPortal";
import styles from "./index.module.less";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  expanded?: boolean;
};

export default function BottomSheet({
  open,
  onClose,
  title,
  action,
  children,
  expanded,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ThemedPortal>
      <div className={styles.overlay} onClick={onClose} />
      <div
        className={`${styles.sheet}${expanded ? ` ${styles.expanded}` : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          {action && <div className={styles.actions}>{action}</div>}
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </ThemedPortal>
  );
}
