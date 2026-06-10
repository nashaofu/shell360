import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useEffect, useState } from "react";
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

const platform = import.meta.env.TAURI_ENV_PLATFORM;
const isMacos = platform === "darwin";

export default function AuthTitleBar() {
  const { hasUpdate, setOpenUpdateDialog } = useUpdateAtom();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      data-platform={platform}
      data-fullscreen={isFullscreen || undefined}
    >
      {!isMacos && (
        <div className={styles.brand}>
          <img src={logo} alt="Shell360" className={styles.logoImg} />
          <span className={styles.appName}>Shell360</span>
        </div>
      )}

      <div className={styles.dragRegion} data-tauri-drag-region="true" />

      <div className={styles.rightRail}>
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

        {!isMacos && hasUpdate && (
          <div className={styles.rightSep} aria-hidden="true" />
        )}

        {!isMacos && (
          <div className={styles.winControls}>
            <button
              type="button"
              className={styles.winControlsBtn}
              onClick={() => getCurrentWindow().minimize()}
              title="Minimize"
            >
              <WindowMinimizeIcon />
            </button>
            <button
              type="button"
              className={styles.winControlsBtn}
              onClick={() => getCurrentWindow().toggleMaximize()}
              title="Maximize"
            >
              {isMaximized ? <WindowRestoreIcon /> : <WindowMaximizeIcon />}
            </button>
            <button
              type="button"
              className={clsx(
                styles.winControlsBtn,
                styles.winControlsBtnClose,
              )}
              onClick={() => getCurrentWindow().close()}
              title="Close"
            >
              <WindowCloseIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
