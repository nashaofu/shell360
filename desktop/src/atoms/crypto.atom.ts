import { checkIsEnableCrypto, checkIsInitCrypto } from "bridge/data";
import { atom, useSetAtom } from "jotai";
import { useCallback } from "react";

export const cryptoIsEnableAtom = atom<boolean>();

cryptoIsEnableAtom.onMount = (setAtom) => {
  void checkIsEnableCrypto().then(setAtom);
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

export const useUpdateCryptoIsEnable = () => {
  const setAtom = useSetAtom(cryptoIsEnableAtom);

  return useCallback(async () => {
    const val = await checkIsEnableCrypto();
    setAtom(val);
  }, [setAtom]);
};
