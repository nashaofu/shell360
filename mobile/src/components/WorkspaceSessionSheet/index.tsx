import { DropdownMenu, IconButton } from "@radix-ui/themes";
import { type ReactNode, useRef, useState } from "react";
import type { TerminalAtom } from "shared";
import {
  AddIcon,
  CheckIcon,
  CloseIcon,
  FolderIcon,
  TerminalIcon,
} from "shared";
import BottomSheet from "@/components/BottomSheet";
import styles from "./index.module.less";

type WorkspaceSessionSheetProps = {
  open: boolean;
  onClose: () => void;
  sessions: TerminalAtom[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCloseSession: (id: string) => void;
  onCreateMenu?: ReactNode;
};

function SessionRow({
  item,
  active,
  onSelect,
  onCloseSession,
}: {
  item: TerminalAtom;
  active: boolean;
  onSelect: () => void;
  onCloseSession: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const startX = useRef<number | null>(null);

  const subtitle =
    item.type === "sftp"
      ? item.host.hostname
      : item.status === "success"
        ? "Connected"
        : item.status === "pending"
          ? "Connecting…"
          : "Failed";

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -24) {
      setRevealed(true);
    } else if (dx > 24) {
      setRevealed(false);
    }
  };

  const onTouchEnd = () => {
    startX.current = null;
  };

  const onRowClick = () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    onSelect();
  };

  return (
    <li className={styles.swipeRow}>
      <button
        type="button"
        className={styles.deleteAction}
        onClick={onCloseSession}
        aria-label={`Close ${item.name}`}
      >
        <CloseIcon aria-hidden="true" />
        Close
      </button>
      <button
        type="button"
        className={`${styles.item}${active ? ` ${styles.active}` : ""}${revealed ? ` ${styles.revealed}` : ""}`}
        onClick={onRowClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
}

export default function WorkspaceSessionSheet({
  open,
  onClose,
  sessions,
  activeId,
  onSelect,
  onCloseSession,
  onCreateMenu,
}: WorkspaceSessionSheetProps) {
  const terminals = sessions.filter((item) => item.type !== "sftp");
  const sftp = sessions.filter((item) => item.type === "sftp");

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
        <ul className={styles.list}>
          {list.map((item) => (
            <SessionRow
              key={item.uuid}
              item={item}
              active={item.uuid === activeId}
              onSelect={() => onSelect(item.uuid)}
              onCloseSession={() => onCloseSession(item.uuid)}
            />
          ))}
        </ul>
      </div>
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Workspace · ${sessions.length}`}
      action={
        onCreateMenu ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton
                type="button"
                size="3"
                variant="ghost"
                className={styles.headerAction}
                aria-label="New session"
              >
                <AddIcon />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="top" align="end" sideOffset={6}>
              {onCreateMenu}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : undefined
      }
    >
      {renderGroup("Terminals", <TerminalIcon aria-hidden="true" />, terminals)}
      {renderGroup("SFTP", <FolderIcon aria-hidden="true" />, sftp)}
    </BottomSheet>
  );
}
