import {
  Heading,
  IconButton,
  Separator,
  Theme,
  useThemeContext,
} from "@radix-ui/themes";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loading } from "shared";

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
  const themeContext = useThemeContext();

  if (!open) return null;

  return createPortal(
    <Theme {...themeContext}>
      <div className={styles.overlay} onClick={onCancel}>
        <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div
            className={styles.header}
            style={{ marginTop: TITLE_BAR_HEIGHT }}
          >
            <Heading size="4" weight="medium">
              {title}
            </Heading>
            {!loading && (
              <IconButton
                type="button"
                variant="ghost"
                color="gray"
                onClick={onCancel}
              >
                <span className="icon-arrow-right" />
              </IconButton>
            )}
          </div>
          <Separator size="4" />
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
              <Separator size="4" />
              <div className={styles.footer}>{footer}</div>
            </>
          )}
        </div>
      </div>
    </Theme>,
    document.body,
  );
}
