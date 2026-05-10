import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import styles from "./index.module.less";

type TitleBarProps = {
  children?: ReactNode;
};

export default function TitleBar({ children }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const isDarwin = import.meta.env.TAURI_ENV_PLATFORM === "darwin";

  const onClickMinimize = useCallback(() => {
    getCurrentWindow().minimize();
  }, []);

  const onClickToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize();
  }, []);

  const onClickClose = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  useEffect(() => {
    getCurrentWindow().isMaximized().then(setIsMaximized);

    const unListen = getCurrentWindow().onResized(() => {
      getCurrentWindow().isMaximized().then(setIsMaximized);
    });

    return () => {
      unListen.then((fn) => fn());
    };
  }, []);

  return (
    <div className={`${styles.titleBar}${isDarwin ? ` ${styles.darwin}` : ""}`}>
      {children && <div className={styles.content}>{children}</div>}
      {!isDarwin && (
        <div className={styles.winControls}>
          <div className={styles.winControlsBtns} onClick={onClickMinimize}>
            <span className="icon-window-minimize" />
          </div>
          <div
            className={styles.winControlsBtns}
            onClick={onClickToggleMaximize}
          >
            {isMaximized ? (
              <span className="icon-window-restore" />
            ) : (
              <span className="icon-window-maximize" />
            )}
          </div>
          <div className={styles.winControlsBtns} onClick={onClickClose}>
            <span className="icon-window-close" />
          </div>
        </div>
      )}
    </div>
  );
}
