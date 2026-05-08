import { useAtomValue } from "jotai";
import type { ReactNode } from "react";

import { authAtom } from "@/atom/authAtom";
import { cryptoIsEnableAtom } from "@/atom/cryptoAtom";
import styles from "./index.module.less";

import UnlockCrypto from "./UnlockCrypto";

export interface AuthProps {
  children: ReactNode;
}

export default function Auth({ children }: AuthProps) {
  const isAuthed = useAtomValue(authAtom);
  const cryptoIsEnable = useAtomValue(cryptoIsEnableAtom);

  if (cryptoIsEnable === undefined) {
    return (
      <div className={styles.authLoading}>
        <span className={styles.spinner} />
      </div>
    );
  }

  if (cryptoIsEnable && !isAuthed) {
    return <UnlockCrypto></UnlockCrypto>;
  }

  return children;
}
