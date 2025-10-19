import { Update, check } from '@tauri-apps/plugin-updater';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { useLatest } from 'ahooks';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateAtom = {
  openUpdateDialog: boolean;
  checking?: Promise<Update | null>;
  update: Update | null;
  isDownloading: boolean;
  error?: unknown;
  total?: number;
  downloaded?: number;
};

export const updateAtom = atom<UpdateAtom>({
  openUpdateDialog: false,
  checking: undefined,
  update: null,
  isDownloading: false,
  error: undefined,
  total: undefined,
  downloaded: undefined,
});

export function useCheckUpdate() {
  const [state, setState] = useAtom(updateAtom);

  const stateRef = useLatest(state);

  const checkUpdate = useCallback(async () => {
    if (stateRef.current.checking) {
      return stateRef.current.checking;
    }

    try {
      const checking = check();
      setState({
        ...stateRef.current,
        checking,
      });
      const update = await checking;
      setState({
        ...stateRef.current,
        checking: undefined,
        update,
      });

      return update;
    } catch (err) {
      setState({
        ...stateRef.current,
        checking: undefined,
        update: null,
      });
      throw err;
    }
  }, [setState, stateRef]);

  return checkUpdate;
}

let timer: number | undefined;

export function useAutoCheckUpdate() {
  const checkUpdate = useCheckUpdate();
  useEffect(() => {
    const autoCheck = async () => {
      try {
        await checkUpdate();
      } finally {
        clearTimeout(timer);
        timer = window.setTimeout(() => autoCheck(), 1000 * 60 * 3);
      }
    };

    autoCheck();

    return () => {
      clearTimeout(timer);
    };
  }, [checkUpdate]);
}

export function useUpdateAtom() {
  const [state, setState] = useAtom(updateAtom);
  const checkUpdate = useCheckUpdate();

  const stateRef = useLatest(state);
  const update = state.update;

  const setOpenUpdateDialog = useCallback(
    (openUpdateDialog: boolean) => {
      stateRef.current = {
        ...stateRef.current,
        openUpdateDialog,
      };
      setState(stateRef.current);
    },
    [setState, stateRef]
  );

  const download = useCallback(async () => {
    const { update } = stateRef.current;
    if (!update) {
      return;
    }

    try {
      stateRef.current = {
        ...stateRef.current,
        isDownloading: true,
        error: undefined,
        total: 0,
        downloaded: 0,
      };
      setState(stateRef.current);

      await update.download((event) => {
        if (event.event === 'Started') {
          stateRef.current = {
            ...stateRef.current,
            total: event.data.contentLength,
            downloaded: 0,
          };
          setState(stateRef.current);
        } else if (event.event === 'Progress') {
          stateRef.current = {
            ...stateRef.current,
            downloaded:
              event.data.chunkLength + (stateRef.current.downloaded || 0),
          };
          setState(stateRef.current);
        } else if (event.event === 'Finished') {
          stateRef.current = {
            ...stateRef.current,
            downloaded: stateRef.current.total,
          };
          setState(stateRef.current);
        }
      });

      stateRef.current = {
        ...stateRef.current,
        isDownloading: false,
        error: undefined,
      };
      setState(stateRef.current);
    } catch (err) {
      stateRef.current = {
        ...stateRef.current,
        isDownloading: false,
        error: err,
      };
      setState(stateRef.current);
    }
  }, [setState, stateRef]);

  const install = useCallback(() => {
    update?.install().finally(() => {
      if (import.meta.env.TAURI_PLATFORM === 'darwin') {
        relaunch();
      }
    });
  }, [update]);

  return {
    ...state,
    setOpenUpdateDialog,
    checkUpdate,
    download,
    install,
  };
}
