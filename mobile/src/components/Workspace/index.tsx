import { DropdownMenu } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownIcon,
  HostIcon,
  MenuIcon,
  MoreIcon,
  SftpBrowser,
  useTerminalsAtomValue,
  useTerminalsAtomWithApi,
} from "shared";
import { useGlobalStateAtomWithApi } from "@/atoms/globalState.atom";
import { useSftpDirValue } from "@/atoms/sftpDir.atom";
import {
  useTerminalActiveId,
  useTerminalViewVisible,
} from "@/atoms/terminalView.atom";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SSHTerminal";
import WorkspaceSessionSheet from "@/components/WorkspaceSessionSheet";
import useMediaQuery from "@/hooks/useMediaQuery";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";

function simplifyPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 2) {
    return path;
  }
  const tail = segments.slice(-2).join("/");
  return `…/${tail}`;
}

export default function Workspace() {
  const terminals = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const [visible, setVisible] = useTerminalViewVisible();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const [openAddKey, setOpenAddKey] = useState(false);
  const [openSessionSheet, setOpenSessionSheet] = useState(false);
  const { openSidebar, toggleSidebar } = useGlobalStateAtomWithApi();
  const isTablet = useMediaQuery("(min-width: 840px)");
  const navigate = useNavigate();
  const terminalItems = useMemo(() => [...terminals.values()], [terminals]);
  const activeTerminal = activeTerminalId
    ? terminals.get(activeTerminalId)
    : undefined;
  const sftpDir = useSftpDirValue(activeTerminalId ?? undefined);

  const hideWorkspace = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const closeSessionSheet = useCallback(() => setOpenSessionSheet(false), []);

  const closeTerminal = useCallback(
    (terminalId: string) => {
      const [, remaining] = terminalsApi.delete(terminalId);

      if (terminalId !== activeTerminalId) return;

      const nextTerminal = remaining.values().next().value;
      setActiveTerminalId(nextTerminal?.uuid ?? null);
      if (!nextTerminal) setVisible(false);
    },
    [activeTerminalId, setActiveTerminalId, setVisible, terminalsApi],
  );

  const sessionSubtitle = useMemo(() => {
    if (!activeTerminal) return "";
    if (activeTerminal.type === "sftp") {
      const dir =
        sftpDir || activeTerminal.host.hostname || activeTerminal.name;
      return `SFTP · ${simplifyPath(dir)}`;
    }
    const state =
      activeTerminal.status === "pending"
        ? "Connecting"
        : activeTerminal.status === "failed"
          ? "Failed"
          : "Connected";
    return `Terminal · ${state}`;
  }, [activeTerminal, sftpDir]);

  useEffect(() => {
    if (!terminalItems.length) {
      setActiveTerminalId(null);
      setOpenSessionSheet(false);
      return;
    }

    if (!activeTerminal) {
      setActiveTerminalId(terminalItems[0].uuid);
    }
  }, [activeTerminal, setActiveTerminalId, terminalItems]);

  useEffect(() => {
    if (openSessionSheet) {
      overlay.add(closeSessionSheet);
    } else {
      overlay.delete(closeSessionSheet);
    }
  }, [closeSessionSheet, openSessionSheet]);

  useEffect(() => {
    if (visible) {
      overlay.add(hideWorkspace);
    } else {
      overlay.delete(hideWorkspace);
    }

    return () => overlay.delete(hideWorkspace);
  }, [hideWorkspace, visible]);

  const isEmpty = !terminalItems.length;

  return (
    <div
      className={`${styles.root} ${visible ? styles.visible : styles.hidden}`}
      aria-hidden={!visible}
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => (isTablet ? toggleSidebar() : openSidebar())}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <button
          type="button"
          className={`${styles.sessionButton}${isEmpty ? ` ${styles.sessionBtnEmpty}` : ""}`}
          onClick={() => {
            if (!isEmpty) setOpenSessionSheet(true);
          }}
          aria-label={isEmpty ? "Workspace" : "Switch session"}
        >
          <span className={styles.titleRow}>
            <span className={styles.sessionName}>
              {activeTerminal?.name ?? "Workspace"}
            </span>
            {!isEmpty && (
              <ArrowDownIcon className={styles.chevron} aria-hidden="true" />
            )}
          </span>
          {sessionSubtitle && (
            <span className={styles.sessionSub}>{sessionSubtitle}</span>
          )}
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Session actions"
              disabled={isEmpty}
            >
              <MoreIcon />
            </button>
          </DropdownMenu.Trigger>
          {!isEmpty && (
            <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
              <DropdownMenu.Item
                onSelect={() => {
                  if (activeTerminalId) closeTerminal(activeTerminalId);
                }}
              >
                Close session
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          )}
        </DropdownMenu.Root>
      </header>

      {isEmpty ? (
        <main className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <HostIcon aria-hidden="true" />
          </div>
          <h2 className={styles.emptyTitle}>No active sessions</h2>
          <p className={styles.emptyDesc}>Open a host terminal to begin.</p>
          <div className={styles.emptyActions}>
            <button
              type="button"
              className="mobile-primary"
              onClick={() => {
                setVisible(false);
                navigate("/");
              }}
            >
              Browse Hosts
            </button>
          </div>
        </main>
      ) : (
        <main className={styles.content}>
          {terminalItems.map((item) => {
            const active = item.uuid === activeTerminalId;

            return (
              <div
                key={item.uuid}
                className={`${styles.session} ${active ? styles.sessionActive : ""}`}
                aria-hidden={!active}
              >
                {item.type === "sftp" ? (
                  <div className={styles.sftpSession}>
                    <SftpBrowser
                      item={item}
                      loadingClassName="mobile-sftp-loading-square"
                      onClose={() => closeTerminal(item.uuid)}
                      onOpenAddKey={() => setOpenAddKey(true)}
                    />
                  </div>
                ) : (
                  <SSHTerminal
                    item={item}
                    style={{ width: "100%", height: "100%" }}
                    onClose={() => closeTerminal(item.uuid)}
                    onOpenAddKey={() => setOpenAddKey(true)}
                  />
                )}
              </div>
            );
          })}
        </main>
      )}

      {!isEmpty && (
        <WorkspaceSessionSheet
          open={openSessionSheet}
          onClose={() => setOpenSessionSheet(false)}
          sessions={terminalItems}
          activeId={activeTerminalId}
          onSelect={(id) => {
            setActiveTerminalId(id);
            setOpenSessionSheet(false);
          }}
          onCloseSession={(id) => closeTerminal(id)}
        />
      )}

      <AddKey
        open={openAddKey}
        onCancel={() => setOpenAddKey(false)}
        onOk={() => setOpenAddKey(false)}
      />
    </div>
  );
}
