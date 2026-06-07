import {
  Heading,
  IconButton,
  Portal,
  Separator,
  Spinner,
  Theme,
} from "@radix-ui/themes";
import clsx from "clsx";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowRightIcon } from "shared";

import { TITLE_BAR_HEIGHT } from "@/utils/titleBar";
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
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCancel = useCallback(() => {
    if (timerRef.current !== null) return;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setClosing(false);
      onCancel();
    }, 200);
  }, [onCancel]);

  const handleKeyDownRef = useRef(handleCancel);
  handleKeyDownRef.current = handleCancel;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleKeyDownRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open && !closing) return null;

  return (
    <Portal>
      <Theme asChild>
        <div className={clsx(styles.overlay, closing && styles.closingOverlay)}>
          <div
            className={clsx(styles.panel, closing && styles.closingPanel)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-drawer-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={styles.header}
              style={{ marginTop: TITLE_BAR_HEIGHT }}
            >
              <Heading id="page-drawer-title" size="4" weight="medium">
                {title}
              </Heading>
              {!loading && (
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  aria-label="Close"
                  onClick={handleCancel}
                >
                  <ArrowRightIcon />
                </IconButton>
              )}
            </div>
            <Separator size="4" />
            <div className={clsx(styles.body, loading && styles.bodyLoading)}>
              <div className={styles.content}>{children}</div>
              {loading && (
                <div className={styles.spinnerOverlay}>
                  <Spinner size="3" />
                </div>
              )}
            </div>
            {footer && (
              <>
                <Separator size="4" />
                <div className={styles.footer}>{footer}</div>
              </>
            )}
          </div>
        </div>
      </Theme>
    </Portal>
  );
}
