import { Text } from "@radix-ui/themes";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { useTerminalsAtomValue } from "shared";
import logo from "@/assets/logo.svg";
import { useActivateTerminal } from "@/hooks/useActivateTerminal";
import styles from "./index.module.less";
import { ReactComponent as WorkspaceIcon } from "./workspace.svg";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const activateTerminal = useActivateTerminal();
  const terminalsState = useTerminalsAtomValue();
  const hasTerminal = terminalsState.size > 0;
  const profileName = "Local User";
  const profileInitials = profileName
    .split(" ")
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onClickMinimize = useCallback(() => {
    getCurrentWindow().minimize();
  }, []);

  const onClickToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize();
  }, []);

  const onClickClose = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  const onClickSessions = useCallback(() => {
    const terminalsList = [...terminalsState.values()];
    const last = terminalsList[terminalsList.length - 1];
    if (!last) {
      return;
    }
    activateTerminal(last.uuid);
  }, [terminalsState, activateTerminal]);

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
    <div className={styles.titleBar}>
      <div className={styles.leftRail}>
        <div className={styles.brand}>
          <span className={styles.logoWrap}>
            <img src={logo} alt="Shell360" className={styles.logoImg} />
          </span>
          <span className={styles.brandText}>
            <Text size="2" weight="medium" className={styles.appName}>
              Shell360
            </Text>
          </span>
        </div>

        <button
          type="button"
          className={styles.workspaceBtn}
          onClick={onClickSessions}
          title={hasTerminal ? "Open current terminal" : "No terminal open"}
          disabled={!hasTerminal}
        >
          <span className={styles.workspaceBtnIcon}>
            <WorkspaceIcon />
          </span>
          <span className={styles.workspaceBtnText}>
            <span className={styles.workspaceBtnLabel}>Workspace</span>
          </span>
        </button>
      </div>

      <div className={styles.centerRail}>
        <button
          type="button"
          className={styles.searchTrigger}
          title="Quick search"
        >
          <span className={styles.searchTriggerIcon}>
            <span className="icon-search" />
          </span>
          <span className={styles.searchTriggerLabel}>Jump to anything</span>
          <span className={styles.searchTriggerHint}>
            Hosts, sessions, commands
          </span>
          <span className={styles.searchTriggerShortcut}>Ctrl K</span>
        </button>
      </div>

      <div className={styles.dragRegion} data-tauri-drag-region="true" />

      <div className={styles.rightRail}>
        <div className={styles.utilityGroup}>
          <button
            type="button"
            className={styles.profileBtn}
            title="User profile"
          >
            <span className={styles.profileAvatar}>{profileInitials}</span>
            <span className={styles.profileName}>{profileName}</span>
          </button>

          <div className={styles.rightSep} aria-hidden="true" />

          <div className={styles.winControls}>
            <button
              type="button"
              className={styles.winControlsBtn}
              onClick={onClickMinimize}
              title="Minimize"
            >
              <span className="icon-window-minimize" />
            </button>
            <button
              type="button"
              className={styles.winControlsBtn}
              onClick={onClickToggleMaximize}
              title="Maximize"
            >
              {isMaximized ? (
                <span className="icon-window-restore" />
              ) : (
                <span className="icon-window-maximize" />
              )}
            </button>
            <button
              type="button"
              className={clsx(
                styles.winControlsBtn,
                styles.winControlsBtnClose,
              )}
              onClick={onClickClose}
              title="Close"
            >
              <span className="icon-window-close" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
