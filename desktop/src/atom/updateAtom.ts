import { Update, check } from '@tauri-apps/plugin-updater';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { useLatest } from 'ahooks';

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

  const setOpenUpdateDialog = useCallback(
    (openUpdateDialog: boolean) => {
      setState({
        ...stateRef.current,
        openUpdateDialog,
      });
    },
    [setState, stateRef]
  );

  const downloadAndInstall = useCallback(async () => {
    const { update } = stateRef.current;
    if (!update) {
      return;
    }

    try {
      setState({
        ...stateRef.current,
        isDownloading: true,
        error: undefined,
        total: 0,
        downloaded: 0,
      });

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setState({
            ...stateRef.current,
            total: event.data.contentLength,
            downloaded: 0,
          });
        } else if (event.event === 'Progress') {
          setState({
            ...stateRef.current,
            downloaded: event.data.chunkLength,
          });
        } else if (event.event === 'Finished') {
          setState({
            ...stateRef.current,
            downloaded: stateRef.current.total,
          });
        }
      });

      setState({
        ...stateRef.current,
        isDownloading: false,
        error: undefined,
      });
    } catch (err) {
      setState({
        ...stateRef.current,
        isDownloading: false,
        error: err,
      });
    }
  }, [setState, stateRef]);

  return {
    ...state,
    setOpenUpdateDialog,
    checkUpdate,
    downloadAndInstall,
  };
}
