import { createPortal } from "react-dom";
import { useCallback, useState } from "react";

import useContextmenu, { type ContextmenuState } from "./useContextmenu";
import styles from "./index.module.less";

export default function Contextmenu() {
  const [contextmenuState, setContextmenuState] = useState<ContextmenuState>({
    open: false,
    menus: [],
    x: 0,
    y: 0,
  });

  const onCloseContextmenu = useCallback(() => {
    setContextmenuState({
      open: false,
      menus: [],
      x: 0,
      y: 0,
    });
  }, []);

  useContextmenu({
    setContextmenuState,
    onCloseContextmenu,
  });

  if (!contextmenuState.open) return null;

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onCloseContextmenu}
      />
      <div
        className={styles.menu}
        style={{ left: contextmenuState.x, top: contextmenuState.y }}
      >
        {contextmenuState.menus.map((item) => (
          <button
            type="button"
            key={item.key}
            className={styles.menuItem}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}
