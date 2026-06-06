import clsx from "clsx";
import {
  type AddPanelOptions,
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
} from "dockview-react";
import { useCallback, useEffect, useRef, useState } from "react";
import "dockview-react/dist/styles/dockview.css";
import { useTerminalsAtomValue, useTerminalsAtomWithApi } from "shared";
import {
  useTerminalActiveId,
  useTerminalViewVisible,
} from "@/atoms/terminalView.atom";
import AddKey from "@/components/AddKey";
import SftpContent from "@/components/SftpPanel";
import TerminalPanel from "@/components/TerminalPanel";
import styles from "./index.module.less";

const PANEL_MIN_WIDTH = 220;
const PANEL_MIN_HEIGHT = 120;

function getAddPanelOptions(
  api: DockviewApi,
  id: string,
  title: string,
  inactive: boolean,
  params: { terminalId: string; onOpenAddKey: () => void },
  type?: string,
): AddPanelOptions<{ terminalId: string; onOpenAddKey: () => void }> {
  return {
    id,
    title,
    inactive,
    component: type === "sftp" ? "sftp" : "terminal",
    params,
    position: {
      referenceGroup: api.activeGroup as NonNullable<typeof api.activeGroup>,
      direction: "within" as const,
    },
    minimumWidth: PANEL_MIN_WIDTH,
    minimumHeight: PANEL_MIN_HEIGHT,
  };
}

const components = {
  terminal: TerminalPanel,
  sftp: SftpContent,
};

export default function Workspace() {
  const terminalsState = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const [visible, setVisible] = useTerminalViewVisible();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const [openAddKey, setOpenAddKey] = useState(false);
  const apiRef = useRef<DockviewApi | null>(null);
  const disposablesRef = useRef<Array<{ dispose(): void }>>([]);
  const addedIdsRef = useRef<Set<string>>(new Set());
  const syncingRef = useRef<Set<string>>(new Set());
  const terminalsRef = useRef(terminalsState);
  terminalsRef.current = terminalsState;
  const activeIdRef = useRef(activeTerminalId);
  activeIdRef.current = activeTerminalId;

  const openAddKeyModal = useCallback(() => setOpenAddKey(true), []);
  const closeAddKeyModal = useCallback(() => setOpenAddKey(false), []);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const { api } = event;

      for (const d of disposablesRef.current) {
        d.dispose();
      }
      apiRef.current = api;

      const disposables: Array<{ dispose(): void }> = [];

      for (const [uuid, term] of terminalsRef.current) {
        api.addPanel(
          getAddPanelOptions(
            api,
            uuid,
            term.name,
            uuid !== activeIdRef.current,
            {
              terminalId: uuid,
              onOpenAddKey: openAddKeyModal,
            },
            term.type,
          ),
        );
        addedIdsRef.current.add(uuid);
      }

      disposables.push(
        api.onDidActivePanelChange((panel) => {
          if (panel) setActiveTerminalId(panel.id);
        }),
      );

      disposables.push(
        api.onDidRemovePanel((panel) => {
          const id = panel.id;
          const synced = syncingRef.current.has(id);
          syncingRef.current.delete(id);
          addedIdsRef.current.delete(id);
          if (!synced) terminalsApi.delete(id);
        }),
      );

      disposablesRef.current = disposables;
    },
    [setActiveTerminalId, terminalsApi, openAddKeyModal],
  );

  useEffect(() => {
    return () => {
      for (const d of disposablesRef.current) {
        d.dispose();
      }
      apiRef.current = null;
      addedIdsRef.current.clear();
      syncingRef.current.clear();
      disposablesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (terminalsState.size === 0) setVisible(false);
  }, [terminalsState, setVisible]);

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
    const addedIds = addedIdsRef.current;

    for (const id of [...addedIds]) {
      if (!currentIds.has(id)) {
        const panel = api.getPanel(id);
        if (panel) {
          syncingRef.current.add(id);
          panel.api.close();
        } else {
          addedIds.delete(id);
        }
      }
    }

    for (const [id, term] of terminalsState) {
      if (!addedIds.has(id)) {
        api.addPanel(
          getAddPanelOptions(
            api,
            id,
            term.name,
            false,
            {
              terminalId: id,
              onOpenAddKey: openAddKeyModal,
            },
            term.type,
          ),
        );
        addedIds.add(id);
        continue;
      }
      const panel = api.getPanel(id);
      if (panel?.title !== term.name) panel?.api.setTitle(term.name);
    }
  }, [terminalsState, openAddKeyModal]);

  return (
    <div
      className={clsx(
        styles.root,
        styles.appDockview,
        visible ? styles.visible : styles.hidden,
      )}
    >
      <DockviewReact
        components={components}
        onReady={onReady}
        className={styles.dockview}
        watermarkComponent={() => (
          <div className={styles.watermark}>
            <span>No terminals open</span>
          </div>
        )}
        disableFloatingGroups
        singleTabMode="default"
        dndStrategy="pointer"
      />
      <AddKey
        open={openAddKey}
        onCancel={closeAddKeyModal}
        onOk={closeAddKeyModal}
      />
    </div>
  );
}
