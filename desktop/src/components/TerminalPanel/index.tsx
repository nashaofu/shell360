import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  type FunctionComponent,
} from "react";
import {
  DockviewReact,
  type AddPanelOptions,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type IWatermarkPanelProps,
  type DockviewApi,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { useTerminalsAtomValue, useTerminalsAtomWithApi } from "shared";
import { useTerminalActiveId, useTerminalViewVisible } from "@/atoms/terminal";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SSHTerminal";
import styles from "./index.module.less";

const TerminalCtx = createContext<{ onOpenAddKey: () => void }>({
  onOpenAddKey: () => {},
});

const PANEL_MIN_WIDTH = 220;
const PANEL_MIN_HEIGHT = 120;
const TAB_CONTEXT_MENU_ITEMS = ["close", "closeOthers", "closeAll", "separator"] as const;

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

const components: Record<string, FunctionComponent<IDockviewPanelProps>> = {
  terminal: TerminalContent,
};

function getAddPanelPosition(api: DockviewApi) {
  const referenceGroup = api.activeGroup;

  if (!referenceGroup) return undefined;

  return {
    referenceGroup,
    direction: "within" as const,
  };
}

function getTerminalPanelOptions(
  api: DockviewApi,
  id: string,
  title: string,
  inactive = false,
): AddPanelOptions<{ terminalId: string }> {
  return {
    id,
    title,
    inactive,
    component: "terminal",
    params: { terminalId: id },
    position: getAddPanelPosition(api),
    minimumWidth: PANEL_MIN_WIDTH,
    minimumHeight: PANEL_MIN_HEIGHT,
  };
}

export default function TerminalPanel() {
  const terminalsState = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const [visible] = useTerminalViewVisible();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const [openAddKey, setOpenAddKey] = useState(false);
  const apiRef = useRef<DockviewApi | null>(null);
  const disposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const addedRef = useRef<Set<string>>(new Set());
  const syncingRemovalRef = useRef<Set<string>>(new Set());
  const terminalsRef = useRef(terminalsState);
  terminalsRef.current = terminalsState;
  const activeIdRef = useRef(activeTerminalId);
  activeIdRef.current = activeTerminalId;
  const openAddKeyModal = useCallback(() => setOpenAddKey(true), []);
  const closeAddKeyModal = useCallback(() => setOpenAddKey(false), []);
  const contextValue = useMemo(() => ({ onOpenAddKey: openAddKeyModal }), [openAddKeyModal]);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const { api } = event;
      const disposables: Array<{ dispose(): void }> = [];

      for (const disposable of disposablesRef.current) {
        disposable.dispose();
      }

      disposablesRef.current = disposables;
      apiRef.current = api;

      for (const [uuid, term] of terminalsRef.current) {
        api.addPanel(getTerminalPanelOptions(api, uuid, term.name, uuid !== activeIdRef.current));
        addedRef.current.add(uuid);
      }

      disposables.push(
        api.onDidActivePanelChange((panel) => {
          if (panel) {
            setActiveTerminalId(panel.id);
          }
        }),
      );

      disposables.push(
        api.onDidRemovePanel((panel) => {
          const id = panel.id;
          const isSyncedRemoval = syncingRemovalRef.current.has(id);

          syncingRemovalRef.current.delete(id);
          addedRef.current.delete(id);

          if (!isSyncedRemoval) {
            terminalsApi.delete(id);
          }
        }),
      );
    },
    [setActiveTerminalId, terminalsApi],
  );

  useEffect(() => {
    return () => {
      apiRef.current = null;
      addedRef.current.clear();
      syncingRemovalRef.current.clear();

      for (const disposable of disposablesRef.current) {
        disposable.dispose();
      }

      disposablesRef.current = [];
    };
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

    const currentIds = new Set(terminalsState.keys());
    const addedIds = addedRef.current;

    for (const id of [...addedIds]) {
      if (!currentIds.has(id)) {
        const panel = api.getPanel(id);

        if (panel) {
          syncingRemovalRef.current.add(id);
          panel.api.close();
        } else {
          addedIds.delete(id);
        }
      }
    }

    for (const [id, term] of terminalsState) {
      if (!addedIds.has(id)) {
        api.addPanel(getTerminalPanelOptions(api, id, term.name));
        addedIds.add(id);
        continue;
      }

      const panel = api.getPanel(id);
      if (panel && panel.title !== term.name) {
        panel.api.setTitle(term.name);
      }
    }
  }, [terminalsState]);

  return (
    <TerminalCtx.Provider value={contextValue}>
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
          getTabContextMenuItems={() => [...TAB_CONTEXT_MENU_ITEMS]}
        />

        <AddKey
          open={openAddKey}
          onCancel={closeAddKeyModal}
          onOk={closeAddKeyModal}
        />
      </div>
    </TerminalCtx.Provider>
  );
}
