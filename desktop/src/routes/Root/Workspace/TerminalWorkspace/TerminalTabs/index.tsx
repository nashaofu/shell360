import type { MouseEvent } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { Dropdown, type TerminalAtom, useTerminalsAtomWithApi } from "shared";
import styles from "./index.module.less";

type TerminalTabsProps = {
  tabs: TerminalAtom[];
  activeTerminalId?: string;
  variant?: "default" | "compact";
};

export default function TerminalTabs({
  tabs,
  activeTerminalId,
  variant = "default",
}: TerminalTabsProps) {
  const navigate = useNavigate();
  const match = useMatch("/terminal/:uuid");
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const closeTerminal = (terminalId: string) => {
    const [, map] = terminalsAtomWithApi.delete(terminalId);

    if (match?.params.uuid !== terminalId) {
      return;
    }

    const next = map.values().next().value;

    if (next) {
      navigate(`/terminal/${next.uuid}`, { replace: true });
      return;
    }

    navigate("/", { replace: true });
  };

  const closeOthers = (terminalId: string) => {
    const rest = tabs.filter((item) => item.uuid !== terminalId);
    rest.forEach((item) => {
      terminalsAtomWithApi.delete(item.uuid);
    });

    navigate(`/terminal/${terminalId}`, { replace: true });
  };

  const closeAll = () => {
    tabs.forEach((item) => {
      terminalsAtomWithApi.delete(item.uuid);
    });

    navigate("/", { replace: true });
  };

  const onCloseClick = (
    event: MouseEvent<HTMLSpanElement>,
    terminalId: string,
  ) => {
    event.stopPropagation();
    closeTerminal(terminalId);
  };

  return (
    <div
      className={`${styles.terminalTabs}${variant === "compact" ? ` ${styles.compact}` : ""}`}
    >
      {tabs.map((item) => {
        const isActive = item.uuid === activeTerminalId;
        const menus = [
          {
            label: "Close",
            value: `close-${item.uuid}`,
            onClick: () => closeTerminal(item.uuid),
          },
          {
            label: "Close others",
            value: `close-others-${item.uuid}`,
            disabled: tabs.length <= 1,
            onClick: () => closeOthers(item.uuid),
          },
          {
            label: "Close all",
            value: `close-all-${item.uuid}`,
            disabled: !tabs.length,
            onClick: closeAll,
          },
        ];

        return (
          <Dropdown
            key={item.uuid}
            menus={menus}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            {({ onChangeOpen }) => (
              <button
                type="button"
                className={`${styles.tab}${isActive ? ` ${styles.active}` : ""}`}
                onClick={() =>
                  navigate(`/terminal/${item.uuid}`, { replace: true })
                }
                onContextMenu={(event) => {
                  event.preventDefault();
                  onChangeOpen(event.currentTarget);
                }}
                title={item.name}
              >
                <span className={styles.statusDot} />
                <span className={styles.tabText}>{item.name}</span>
                <span
                  className={styles.close}
                  onClick={(event) => onCloseClick(event, item.uuid)}
                >
                  <span className="icon-close" />
                </span>
              </button>
            )}
          </Dropdown>
        );
      })}
    </div>
  );
}
