import { DropdownMenu } from "@radix-ui/themes";
import type { ReactNode } from "react";
import type { TerminalAtom } from "shared";
import { AddIcon, CheckIcon, FolderIcon, TerminalIcon } from "shared";
import BottomSheet from "@/components/BottomSheet";
import styles from "./index.module.less";

type WorkspaceSessionSheetProps = {
  open: boolean;
  onClose: () => void;
  sessions: TerminalAtom[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateMenu: ReactNode;
};

export default function WorkspaceSessionSheet({
  open,
  onClose,
  sessions,
  activeId,
  onSelect,
  onCreateMenu,
}: WorkspaceSessionSheetProps) {
  const terminals = sessions.filter((item) => item.type !== "sftp");
  const sftp = sessions.filter((item) => item.type === "sftp");

  const renderItem = (item: TerminalAtom) => {
    const active = item.uuid === activeId;
    const subtitle =
      item.type === "sftp"
        ? item.host.hostname
        : item.status === "success"
          ? "Connected"
          : item.status === "pending"
            ? "Connecting…"
            : "Failed";
    return (
      <li key={item.uuid}>
        <button
          type="button"
          className={`${styles.item}${active ? ` ${styles.active}` : ""}`}
          onClick={() => onSelect(item.uuid)}
        >
          <span
            className={`${styles.statusDot} ${styles[item.status]}`}
            aria-hidden="true"
          />
          <span className={styles.itemMain}>
            <span className={styles.itemName}>{item.name}</span>
            <span className={styles.itemSub}>{subtitle}</span>
          </span>
          {active && <CheckIcon className={styles.check} aria-hidden="true" />}
        </button>
      </li>
    );
  };

  const renderGroup = (
    label: string,
    icon: ReactNode,
    list: TerminalAtom[],
  ) => {
    if (!list.length) return null;
    return (
      <div className={styles.group}>
        <p className={styles.groupLabel}>
          {icon}
          {label}
        </p>
        <ul className={styles.list}>{list.map(renderItem)}</ul>
      </div>
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Workspace · ${sessions.length}`}
      action={
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button
              type="button"
              className="mobile-icon-btn"
              style={{ width: 40, height: 40 }}
              aria-label="New session"
            >
              <AddIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="top" align="end" sideOffset={6}>
            {onCreateMenu}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      {renderGroup("Terminals", <TerminalIcon aria-hidden="true" />, terminals)}
      {renderGroup("SFTP", <FolderIcon aria-hidden="true" />, sftp)}
    </BottomSheet>
  );
}
