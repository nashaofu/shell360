import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import {
  UpgradeIcon,
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
  WindowRestoreIcon,
} from "shared";
import logo from "@/assets/logo.svg";
import { useUpdateAtom } from "@/atoms/update.atom";
import styles from "./index.module.less";

export default function AuthTitleBar() {
  const isMacos = import.meta.env.TAURI_ENV_PLATFORM === "darwin";
  const { hasUpdate, setOpenUpdateDialog } = useUpdateAtom();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    const win = getCurrentWindow();
    const sync = () => {
      win.isMaximized().then(setIsMaximized);
      win.isFullscreen().then(setIsFullscreen);
    };
    sync();

    const unListen = win.onResized(sync);

    return () => {
      unListen.then((fn) => fn());
    };
  }, []);

  return (
    <div
      className={styles.titleBar}
      data-platform={import.meta.env.TAURI_ENV_PLATFORM}
      data-fullscreen={isFullscreen ? "true" : undefined}
    >
      <div className={styles.brand}>
        <img src={logo} alt="Shell360" className={styles.logoImg} />
        <span className={styles.appName}>Shell360</span>
      </div>

      <div className={styles.dragRegion} data-tauri-drag-region="true" />

      {!isMacos && (
        <div className={styles.rightRail}>
          <div className={styles.utilityGroup}>
            {hasUpdate && (
              <button
                type="button"
                className={styles.updateBtn}
                onClick={() => setOpenUpdateDialog(true)}
                title="Update available"
              >
                <UpgradeIcon />
              </button>
            )}

            <div className={styles.rightSep} aria-hidden="true" />

            <div className={styles.winControls}>
              <button
                type="button"
                className={styles.winControlsBtn}
                onClick={onClickMinimize}
                title="Minimize"
              >
                <WindowMinimizeIcon />
              </button>
              <button
                type="button"
                className={styles.winControlsBtn}
                onClick={onClickToggleMaximize}
                title="Maximize"
              >
                {isMaximized ? <WindowRestoreIcon /> : <WindowMaximizeIcon />}
              </button>
              <button
                type="button"
                className={clsx(styles.winControlsBtn, styles.winControlsBtnClose)}
                onClick={onClickClose}
                title="Close"
              >
                <WindowCloseIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
