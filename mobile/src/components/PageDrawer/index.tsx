import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loading } from "shared";

import overlay from "@/utils/overlay";
import styles from "./index.module.less";

type PageDrawerProps = {
  loading?: boolean;
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onCancel: () => unknown;
};

export default function PageDrawer({
  loading,
  open,
  title,
  children,
  footer,
  onCancel,
}: PageDrawerProps) {
  useEffect(() => {
    if (open) {
      overlay.add(onCancel);
    } else {
      overlay.delete(onCancel);
    }

    return () => {
      overlay.delete(onCancel);
    };
  }, [onCancel, open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.backBtn}
            disabled={!!loading}
            onClick={onCancel}
          >
            <span className="icon-arrow-left" />
          </button>
          <h6 className={styles.title}>{title}</h6>
          <button
            type="button"
            className={styles.closeBtn}
            disabled={!!loading}
            onClick={onCancel}
          >
            <span className="icon-close" />
          </button>
        </div>
        <hr className={styles.divider} />
        <Loading
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          loading={loading}
          size={32}
        >
          <div className={styles.content}>{children}</div>
        </Loading>
        {footer && (
          <>
            <hr className={styles.divider} />
            <div className={styles.footer}>{footer}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
