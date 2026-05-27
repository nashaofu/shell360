import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect } from "react";

export type UpdateAtom = {
  hasUpdate: boolean;
  openUpdateDialog: boolean;
  checking?: Promise<Update | null>;
  update: Update | null;
  isDownloading: boolean;
  error?: unknown;
  total?: number;
  downloaded?: number;
};

export const updateAtom = atom<UpdateAtom>({
  hasUpdate: false,
  openUpdateDialog: false,
  checking: undefined,
  update: null,
  isDownloading: false,
  error: undefined,
  total: undefined,
  downloaded: undefined,
});

let activeChecking: Promise<Update | null> | undefined;

export function useCheckUpdate() {
  const setState = useSetAtom(updateAtom);
  const store = useStore();

  const checkUpdate = useCallback(async () => {
    if (activeChecking) {
      return activeChecking;
    }

    const currentState = store.get(updateAtom);
    if (currentState.checking) {
      activeChecking = currentState.checking;
      return currentState.checking;
    }

    const checking = check();
    activeChecking = checking;

    setState((prev) => {
      if (prev.checking) {
        return prev;
      }

      return {
        ...prev,
        checking,
      };
    });

    try {
      const update = await checking;

      setState((prev) => ({
        ...prev,
        checking: prev.checking === checking ? undefined : prev.checking,
        hasUpdate: !!update,
        update,
      }));

      if (activeChecking === checking) {
        activeChecking = undefined;
      }

      return update;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        checking: prev.checking === checking ? undefined : prev.checking,
        hasUpdate: false,
        update: null,
      }));

      if (activeChecking === checking) {
        activeChecking = undefined;
      }

      throw err;
    }
  }, [setState, store]);

  return checkUpdate;
}

let timer: number | undefined;

export function useAutoCheckUpdate() {
  const checkUpdate = useCheckUpdate();
  useEffect(() => {
    const autoCheckUpdate = async () => {
      let update: Update | null = null;
      try {
        update = await checkUpdate();
      } finally {
        clearTimeout(timer);
        if (!update) {
          timer = window.setTimeout(() => autoCheckUpdate(), 1000 * 60 * 3);
        }
      }
    };

    autoCheckUpdate();

    return () => {
      clearTimeout(timer);
    };
  }, [checkUpdate]);
}

export function useUpdateAtom() {
  const state = useAtomValue(updateAtom);
  const setState = useSetAtom(updateAtom);
  const store = useStore();
  const checkUpdate = useCheckUpdate();

  const setOpenUpdateDialog = useCallback(
    (openUpdateDialog: boolean) => {
      setState((prev) => ({
        ...prev,
        openUpdateDialog,
      }));
    },
    [setState],
  );

  const download = useCallback(async () => {
    const update = store.get(updateAtom).update;
    if (!update) {
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isDownloading: true,
        error: undefined,
        total: 0,
        downloaded: 0,
      }));

      await update.download((event) => {
        if (event.event === "Started") {
          setState((prev) => ({
            ...prev,
            total: event.data.contentLength,
            downloaded: 0,
          }));
        } else if (event.event === "Progress") {
          setState((prev) => ({
            ...prev,
            downloaded: event.data.chunkLength + (prev.downloaded || 0),
          }));
        } else if (event.event === "Finished") {
          setState((prev) => ({
            ...prev,
            downloaded: prev.total,
          }));
        }
      });

      setState((prev) => ({
        ...prev,
        isDownloading: false,
        error: undefined,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isDownloading: false,
        error: err,
      }));
    }
  }, [setState, store]);

  const install = useCallback(() => {
    const update = store.get(updateAtom).update;
    update?.install().finally(() => {
      if (import.meta.env.TAURI_ENV_PLATFORM === "darwin") {
        relaunch();
      }
    });
  }, [store]);

  return {
    ...state,
    setOpenUpdateDialog,
    checkUpdate,
    download,
    install,
  };
}
