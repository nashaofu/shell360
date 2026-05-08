import { useCallback } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { type TerminalAtom, useTerminalsAtomWithApi } from "shared";
import styles from "./index.module.less";

type TerminalsProps = {
  onClick?: () => unknown;
};

export default function Terminals({ onClick }: TerminalsProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const onListItemClick = useCallback(
    (item: TerminalAtom) => {
      navigate(`/terminal/${item.uuid}`);
      onClick?.();
    },
    [navigate, onClick],
  );

  return (
    <ul className={styles.list}>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const isActive = !!matchPath(
          { path: `/terminal/${item.uuid}`, end: true },
          pathname,
        );
        return (
          <li key={item.uuid} className={styles.item}>
            <button
              type="button"
              className={`${styles.itemBtn}${isActive ? ` ${styles.active}` : ""}`}
              onClick={() => onListItemClick(item)}
            >
              <span className={`${styles.itemIcon} icon-terminal`} />
              <span className={styles.itemText}>{item.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
