import { atom, useSetAtom } from 'jotai';
import { LazyStore } from '@tauri-apps/plugin-store';
import { checkIsInitCrypto } from 'tauri-plugin-data';
import { useCallback } from 'react';

const store = new LazyStore('config.json');

export const cryptoIsEnableAtom = atom<boolean>();

cryptoIsEnableAtom.onMount = (setAtom) => {
  store.get<boolean>('crypto_enable').then((val) => {
    setAtom(val || false);
  });
  const unListen = store.onKeyChange<boolean>('crypto_enable', (val) => {
    setAtom(val || false);
  });

  return async () => {
    (await unListen)();
  };
};

export const cryptoIsInitAtom = atom<boolean>();

cryptoIsInitAtom.onMount = (setAtom) => {
  checkIsInitCrypto().then((val) => {
    setAtom(val);
  });
};

export const useUpdateCryptoIsInit = () => {
  const setAtom = useSetAtom(cryptoIsInitAtom);

  return useCallback(async () => {
    const val = await checkIsInitCrypto();
    setAtom(val);
  }, [setAtom]);
};
