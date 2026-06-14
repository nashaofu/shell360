import { DropdownMenu } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import {
  MenuIcon,
  MoreIcon,
  type TerminalAtom,
  useTerminalsAtomWithApi,
} from "shared";
import { useGlobalStateAtomWithApi } from "@/atoms/globalState.atom";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SSHTerminal";
import styles from "./index.module.less";

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
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={globalStateAtomWithApi.openSidebar}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <div className={styles.name}>{activeTerminal?.name || "Shell360"}</div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button type="button" className={styles.moreBtn}>
              <MoreIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
            {headerRightMenus.map((item) => (
              <DropdownMenu.Item
                key={item.value}
                onSelect={() => item.onClick?.()}
              >
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const visible = match?.params.uuid === item.uuid;
        return (
          <SSHTerminal
            key={item.uuid}
            style={{
              display: visible ? "flex" : "none",
              flex: 1,
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
