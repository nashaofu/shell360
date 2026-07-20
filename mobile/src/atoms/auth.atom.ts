import { checkIsAuthed, onAuthedChange } from "bridge/data";
import { atom } from "jotai";

export const authAtom = atom<boolean>();

authAtom.onMount = (setAtom) => {
  checkIsAuthed().then((isAuthed) => {
    setAtom(isAuthed);
  });
  const unListen = onAuthedChange((val) => {
    setAtom(val);
  });

  return async () => {
    (await unListen)();
  };
};
