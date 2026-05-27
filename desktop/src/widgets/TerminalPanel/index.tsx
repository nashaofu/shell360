import { useCallback, useContext, useEffect, useRef, useState, createContext } from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type IWatermarkPanelProps,
  type DockviewApi,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { useTerminalsAtomValue, useTerminalsAtomWithApi } from "shared";
import { useTerminalActiveId, useTerminalViewVisible } from "@/app/model/terminalPanelAtom";
import AddKey from "@/features/keys/addKey";
import SSHTerminal from "@/widgets/SshTerminal";
import styles from "./index.module.less";

const TerminalCtx = createContext<{ onOpenAddKey: () => void }>({
  onOpenAddKey: () => {},
});

function TerminalContent({ params, api }: IDockviewPanelProps<{ terminalId: string }>) {
  const { terminalId } = params;
  const terminalsState = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const { onOpenAddKey } = useContext(TerminalCtx);
  const term = terminalsState.get(terminalId);

  if (!term) return null;

  return (
    <SSHTerminal
      item={term}
      style={{ width: "100%", height: "100%" }}
      onClose={() => {
        api.close();
        terminalsApi.delete(terminalId);
      }}
      onOpenAddKey={onOpenAddKey}
    />
  );
}

function Watermark(_props: IWatermarkPanelProps) {
  return (
    <div className={styles.watermark}>
      <span>No terminals open</span>
    </div>
  );
}

const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  terminal: TerminalContent,
};

type TerminalDockviewApi = DockviewApi;

function getAddPanelPosition(api: TerminalDockviewApi) {
  const referenceGroup = api.activeGroup;

  if (!referenceGroup) return undefined;

  return {
    referenceGroup,
    direction: "within" as const,
  };
}

export default function TerminalPanel() {
  const terminalsState = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const [visible] = useTerminalViewVisible();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const [openAddKey, setOpenAddKey] = useState(false);
  const apiRef = useRef<TerminalDockviewApi | null>(null);
  const addedRef = useRef<Set<string>>(new Set());
  const terminalsRef = useRef(terminalsState);
  terminalsRef.current = terminalsState;
  const activeIdRef = useRef(activeTerminalId);
  activeIdRef.current = activeTerminalId;

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const { api } = event;
    apiRef.current = api;

    for (const [uuid, term] of terminalsRef.current) {
      api.addPanel({
        id: uuid,
        component: "terminal",
        title: term.name,
        params: { terminalId: uuid },
        minimumWidth: 220,
        minimumHeight: 120,
        inactive: uuid !== (activeIdRef.current ?? ""),
      });
      addedRef.current.add(uuid);
    }

    api.onDidActivePanelChange((panel) => {
      if (panel) {
        setActiveTerminalId(panel.id);
      }
    });

    api.onDidRemovePanel((panel) => {
      const id = panel.id;
      if (addedRef.current.has(id)) {
        addedRef.current.delete(id);
        terminalsApi.delete(id);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeTerminalId || !terminalsState.has(activeTerminalId)) {
      const first = terminalsState.values().next().value;
      setActiveTerminalId(first?.uuid ?? null);
      return;
    }

    apiRef.current?.getPanel(activeTerminalId)?.api.setActive();
  }, [terminalsState, activeTerminalId, setActiveTerminalId]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const currentIds = new Set([...terminalsState.keys()]);
    const addedIds = addedRef.current;

    for (const id of addedIds) {
      if (!currentIds.has(id)) {
        addedIds.delete(id);
      }
    }

    for (const id of currentIds) {
      if (!addedIds.has(id)) {
        const term = terminalsState.get(id)!;
        api.addPanel({
          id,
          component: "terminal",
          title: term.name,
          params: { terminalId: id },
          position: getAddPanelPosition(api),
          minimumWidth: 220,
          minimumHeight: 120,
        });
        addedIds.add(id);
      }
    }
  }, [terminalsState]);

  return (
    <TerminalCtx.Provider value={{ onOpenAddKey: () => setOpenAddKey(true) }}>
      <div
        className={`${styles.root} ${styles.appDockview} ${visible ? styles.visible : styles.hidden}`}
      >
        <DockviewReact
          components={components}
          onReady={onReady}
          className={styles.dockview}
          watermarkComponent={Watermark}
          disableFloatingGroups
          singleTabMode="default"
          dndStrategy="pointer"
          getTabContextMenuItems={() => [
            "close",
            "closeOthers",
            "closeAll",
            "separator",
          ]}
        />

        <AddKey
          open={openAddKey}
          onCancel={() => setOpenAddKey(false)}
          onOk={() => setOpenAddKey(false)}
        />
      </div>
    </TerminalCtx.Provider>
  );
}
