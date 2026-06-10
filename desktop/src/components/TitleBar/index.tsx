import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useEffect, useState } from "react";
import {
  SearchIcon,
  UpgradeIcon,
  useTerminalsAtomValue,
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
  WindowRestoreIcon,
  WorkspaceIcon,
} from "shared";
import logo from "@/assets/logo.svg";
import { useTerminalViewVisible } from "@/atoms/terminalView.atom";
import { useUpdateAtom } from "@/atoms/update.atom";
import QuickSearch from "@/components/QuickSearch";
import styles from "./index.module.less";

const platform = import.meta.env.TAURI_ENV_PLATFORM;
const isMacos = platform === "darwin";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [visible, setVisible] = useTerminalViewVisible();
  const terminalsState = useTerminalsAtomValue();
  const hasTerminal = terminalsState.size > 0;
  const { hasUpdate, setOpenUpdateDialog } = useUpdateAtom();

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className={styles.titleBar}
      data-platform={platform}
      data-fullscreen={isFullscreen || undefined}
    >
      <div className={styles.leftRail}>
        {!isMacos && (
          <div className={styles.brand}>
            <img src={logo} alt="Shell360" className={styles.logoImg} />
            <span className={styles.appName}>Shell360</span>
          </div>
        )}

        <button
          type="button"
          className={clsx(
            styles.workspaceBtn,
            visible && styles.workspaceBtnActive,
          )}
          onClick={() => setVisible((prev) => !prev)}
          title={
            hasTerminal
              ? visible
                ? "Hide workspace"
                : "Show workspace"
              : "No terminal open"
          }
          disabled={!hasTerminal}
        >
          <span className={styles.workspaceBtnIcon}>
            <WorkspaceIcon />
          </span>
          <span className={styles.workspaceBtnLabel}>Workspace</span>
        </button>
      </div>

      <div className={styles.centerRail}>
        <button
          type="button"
          className={styles.searchTrigger}
          title="Quick search"
          onClick={() => setSearchOpen(true)}
        >
          <span className={styles.searchTriggerIcon}>
            <SearchIcon />
          </span>
          <span className={styles.searchTriggerLabel}>Search</span>
          <span className={styles.searchTriggerShortcut}>
            {isMacos ? "\u2318 K" : "Ctrl K"}
          </span>
        </button>
      </div>

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

      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
