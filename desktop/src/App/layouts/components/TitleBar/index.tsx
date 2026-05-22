import { Badge, Text } from "@radix-ui/themes";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTerminalsAtomValue } from "shared";
import logo from "@/shared/assets/logo.svg";
import styles from "./index.module.less";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const navigate = useNavigate();
  const terminalsState = useTerminalsAtomValue();
  const terminals = [...terminalsState.values()];
  const terminalCount = terminals.length;
  const hasTerminal = terminalCount > 0;

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
    navigate(`/terminal/${last.uuid}`);
  }, [terminalsState, navigate]);

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
      <div className={styles.brand}>
        <img src={logo} alt="Shell360" className={styles.logoImg} />
        <Text size="2" weight="medium" className={styles.appName}>
          Shell360
        </Text>
      </div>
      <button
        type="button"
        className={styles.workspaceBtn}
        onClick={onClickSessions}
        title={
          hasTerminal ? "Switch to Workspace" : "No terminal workspace open"
        }
        disabled={!hasTerminal}
      >
        <span className={styles.workspaceBtnIcon}>
          <span className="icon-terminal" />
        </span>
        <span className={styles.workspaceBtnLabel}>Workspace</span>
        <span className={styles.workspaceBtnMeta}>
          <span
            className={clsx(
              styles.workspaceBtnDot,
              terminalCount === 0 && styles.workspaceBtnDotIdle,
            )}
          />
          <Badge size="1" variant="soft" color="blue" radius="full">
            {terminalCount}
          </Badge>
        </span>
        <span
          className={clsx("icon-arrow-right", styles.workspaceBtnChevron)}
        />
      </button>
      {/* <div className={styles.searchWrap}>
        <button type="button" className={styles.searchBar}>
          <span className={clsx("icon-search", styles.searchIcon)} />
          <span className={styles.searchPlaceholder}>
            Search sessions, commands, logs...
          </span>
          <span className={styles.kbd}>{shortcutLabel}</span>
        </button>
      </div> */}
      <div className={styles.dragRegion} data-tauri-drag-region="true" />
      <div className={styles.topbarRight}>
        {/* <button type="button" className={styles.profileBtn} title="Account">
          <Avatar
            fallback="S3"
            radius="full"
            className={styles.profileAvatar}
          />
          <span className={styles.profileName}>Shell360</span>
          <span className="icon-angle-down" />
        </button>
        <div className={styles.topbarSep} /> */}
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
            className={clsx(styles.winControlsBtn, styles.winControlsBtnClose)}
            onClick={onClickClose}
            title="Close"
          >
            <span className="icon-window-close" />
          </button>
        </div>
      </div>
    </div>
  );
}
