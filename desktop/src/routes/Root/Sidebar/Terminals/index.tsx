import { type MouseEvent, useCallback } from "react";
import {
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { type TerminalAtom, useTerminalsAtomWithApi } from "shared";
import styles from "./index.module.less";

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
    (event: MouseEvent<HTMLDivElement>, item: TerminalAtom) => {
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
    <div className={styles.terminals}>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const isActive = !!matchPath(
          { path: `/terminal/${item.uuid}`, end: true },
          pathname,
        );
        return (
          <div
            key={item.uuid}
            className={`${styles.terminal}${isActive ? ` ${styles.active}` : ""}`}
            title={item.name}
            onClick={() => onListItemClick(item)}
          >
            <span className={`${styles.terminalIcon} icon-terminal`} />
            {expand && <span className={styles.terminalText}>{item.name}</span>}
            {expand && (
              <div
                className={styles.terminalClose}
                onClick={(e) => onListItemCloseClick(e, item)}
                title="Close"
              >
                <span className="icon-close" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
