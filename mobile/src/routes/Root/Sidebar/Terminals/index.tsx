import { useCallback } from "react";
import {
  type TerminalAtom,
  TerminalIcon,
  useTerminalsAtomWithApi,
} from "shared";
import {
  useSetTerminalActiveId,
  useSetTerminalViewVisible,
  useTerminalActiveId,
} from "@/atoms/terminalView.atom";
import styles from "./index.module.less";

type TerminalsProps = {
  onClick?: () => unknown;
};

export default function Terminals({ onClick }: TerminalsProps) {
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const [activeTerminalId] = useTerminalActiveId();
  const setActiveTerminalId = useSetTerminalActiveId();
  const setTerminalViewVisible = useSetTerminalViewVisible();

  const onListItemClick = useCallback(
    (item: TerminalAtom) => {
      setActiveTerminalId(item.uuid);
      setTerminalViewVisible(true);
      onClick?.();
    },
    [onClick, setActiveTerminalId, setTerminalViewVisible],
  );

  return (
    <ul className={styles.list}>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const isActive = activeTerminalId === item.uuid;
        return (
          <li key={item.uuid} className={styles.item}>
            <button
              type="button"
              className={`${styles.itemBtn}${isActive ? ` ${styles.active}` : ""}`}
              onClick={() => onListItemClick(item)}
            >
              <TerminalIcon className={styles.itemIcon} />
              <span className={styles.itemText}>{item.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
