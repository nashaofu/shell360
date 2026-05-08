import { type MouseEvent, useCallback } from "react";
import {
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { type TerminalAtom, useTerminalsAtomWithApi } from "shared";
import styles from "../Menus/index.module.less";

type TerminalsProps = {
  expand?: boolean;
  onClick?: () => unknown;
};

export default function Terminals({ expand, onClick }: TerminalsProps) {
  const { pathname } = useLocation();
  const match = useMatch("/terminal/:uuid");
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const onListItemClick = useCallback(
    (item: TerminalAtom) => {
      navigate(`/terminal/${item.uuid}`, { replace: true });
      onClick?.();
    },
    [navigate, onClick],
  );

  const onListItemCloseClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, item: TerminalAtom) => {
      event.stopPropagation();
      const [, map] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const first = map.values().next().value;
        if (first) {
          navigate(`/terminal/${first.uuid}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    },
    [match?.params.uuid, navigate, terminalsAtomWithApi],
  );

  return (
    <ul className={styles.list}>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const isActive = !!matchPath(
          { path: `/terminal/${item.uuid}`, end: true },
          pathname,
        );
        return (
          <li key={item.uuid} className={styles.item} title={item.name}>
            <button
              type="button"
              className={`${styles.itemBtn}${isActive ? ` ${styles.active}` : ""}`}
              onClick={() => onListItemClick(item)}
            >
              <span className={`${styles.itemIcon} icon-terminal`} />
              {expand && <span className={styles.itemText}>{item.name}</span>}
              {expand && (
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={(e) => onListItemCloseClick(e, item)}
                  title="Close"
                >
                  <span className="icon-close" style={{ fontSize: 14 }} />
                </button>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
