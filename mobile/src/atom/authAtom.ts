import { atom } from 'jotai';
import { checkIsAuthed, onAuthedChange } from 'tauri-plugin-data';

export const authAtom = atom(false);

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
