import { useCallback, useEffect, useMemo, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { Dropdown, type TerminalAtom, useTerminalsAtomWithApi } from "shared";
import { useGlobalStateAtomWithApi } from "@/atom/globalState";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SSHTerminal";

export default function Terminals() {
  const match = useMatch("/terminal/:uuid");
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

  const activeTerminal = useMemo(
    () => terminalsAtomWithApi.state.get(match?.params.uuid as string),
    [match?.params.uuid, terminalsAtomWithApi.state],
  );

  const onClose = useCallback(
    (item: TerminalAtom) => {
      const [, map] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const first = map.values().next().value;
        if (first) {
          navigate(`/terminal/${first.uuid}`, {
            replace: true,
          });
        } else {
          navigate("/", {
            replace: true,
          });
        }
      }
    },
    [match?.params.uuid, navigate, terminalsAtomWithApi],
  );

  const headerRightMenus = useMemo(
    () => [
      {
        label: "Close",
        value: "Close",
        onClick: () => {
          if (activeTerminal) {
            onClose(activeTerminal);
          }
        },
      },
    ],
    [activeTerminal, onClose],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run when terminal count changes
  useEffect(() => {
    if (!terminalsAtomWithApi.state.size && match) {
      navigate("/", { replace: true });
    }
  }, [terminalsAtomWithApi.state.size, navigate]);

  return (
    <div
      style={{
        flexGrow: 1,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          paddingTop: "env(safe-area-inset-top)",
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          paddingRight: 12,
          borderBottom: "1px solid var(--gray-a6)",
          background: "var(--color-panel-solid)",
          color: "var(--gray-12)",
          gap: 8,
        }}
      >
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            padding: 4,
          }}
          onClick={globalStateAtomWithApi.openSidebar}
        >
          <span className="icon-menu" />
        </button>
        <div
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeTerminal?.name || "Shell360"}
        </div>
        <Dropdown menus={headerRightMenus}>
          {({ onChangeOpen }) => (
            <button
              type="button"
              style={{
                marginLeft: 8,
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 4,
              }}
              onClick={(event) => onChangeOpen(event.currentTarget)}
            >
              <span className="icon-more" />
            </button>
          )}
        </Dropdown>
      </div>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const visible = match?.params.uuid === item.uuid;
        return (
          <SSHTerminal
            key={item.uuid}
            style={{
              display: visible ? "flex" : "none",
              flexGrow: 1,
              flexShrink: 0,
            }}
            item={item}
            onClose={() => onClose(item)}
            onOpenAddKey={() => setAddKeyOpen(true)}
          />
        );
      })}
      <AddKey
        open={addKeyOpen}
        onCancel={() => setAddKeyOpen(false)}
        onOk={() => setAddKeyOpen(false)}
      />
    </div>
  );
}
