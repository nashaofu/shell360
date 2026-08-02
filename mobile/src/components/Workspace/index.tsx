import { DropdownMenu } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CloseIcon,
  FolderIcon,
  TerminalIcon,
  useTerminalsAtomValue,
  useTerminalsAtomWithApi,
} from "shared";
import {
  useTerminalActiveId,
  useTerminalViewVisible,
} from "@/atoms/terminalView.atom";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SSHTerminal";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";

export default function Workspace() {
  const terminals = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const [visible, setVisible] = useTerminalViewVisible();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const [openAddKey, setOpenAddKey] = useState(false);
  const terminalItems = useMemo(() => [...terminals.values()], [terminals]);
  const activeTerminal = activeTerminalId
    ? terminals.get(activeTerminalId)
    : undefined;

  const hideWorkspace = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

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

  useEffect(() => {
    if (!terminalItems.length) {
      setActiveTerminalId(null);
      setVisible(false);
      return;
    }

    if (!activeTerminal) {
      setActiveTerminalId(terminalItems[0].uuid);
    }
  }, [activeTerminal, setActiveTerminalId, setVisible, terminalItems]);

  useEffect(() => {
    if (visible) {
      overlay.add(hideWorkspace);
    } else {
      overlay.delete(hideWorkspace);
    }

    return () => overlay.delete(hideWorkspace);
  }, [hideWorkspace, visible]);

  if (!terminalItems.length) return null;

  return (
    <div
      className={`${styles.root} ${visible ? styles.visible : styles.hidden}`}
      aria-hidden={!visible}
    >
      <header className={styles.header}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={hideWorkspace}
          aria-label="Back to app"
        >
          <ArrowLeftIcon />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button type="button" className={styles.sessionButton}>
              <span
                className={`${styles.status} ${activeTerminal ? styles[activeTerminal.status] : ""}`}
              />
              <span className={styles.sessionName}>
                {activeTerminal?.name ?? "Sessions"}
              </span>
              <span className={styles.chevron}>⌄</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            side="bottom"
            align="center"
            sideOffset={6}
            className={styles.sessionMenu}
          >
            {terminalItems.map((item) => (
              <DropdownMenu.Item
                key={item.uuid}
                onSelect={() => setActiveTerminalId(item.uuid)}
              >
                {item.type === "sftp" ? <FolderIcon /> : <TerminalIcon />}
                <span className={styles.menuItemName}>{item.name}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            if (activeTerminalId) closeTerminal(activeTerminalId);
          }}
          aria-label="Close session"
          disabled={!activeTerminalId}
        >
          <CloseIcon />
        </button>
      </header>

      <main className={styles.content}>
        {terminalItems.map((item) => {
          const active = item.uuid === activeTerminalId;

          return (
            <div
              key={item.uuid}
              className={`${styles.session} ${active ? styles.sessionActive : ""}`}
              aria-hidden={!active}
            >
              <SSHTerminal
                item={item}
                style={{ width: "100%", height: "100%" }}
                onClose={() => closeTerminal(item.uuid)}
                onOpenAddKey={() => setOpenAddKey(true)}
              />
            </div>
          );
        })}
      </main>

      <AddKey
        open={openAddKey}
        onCancel={() => setOpenAddKey(false)}
        onOk={() => setOpenAddKey(false)}
      />
    </div>
  );
}
