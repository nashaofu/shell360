import { Button } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { useSetAtom } from "jotai";
import { type KeyboardEvent, useCallback, useState } from "react";
import { Loading, TextFieldPassword } from "shared";
import { loadCryptoByPassword, resetCrypto } from "tauri-plugin-data";
import { authAtom } from "@/atom/authAtom";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import styles from "./index.module.scss";

export default function UnlockVault() {
  const setIsAuth = useSetAtom(authAtom);
  const [password, setPassword] = useState("");
  const message = useMessage();
  const modal = useModal();

  const { run: onUnlock, loading: loadCryptoLoading } = useRequest(
    () => loadCryptoByPassword({ password }),
    {
      manual: true,
      onSuccess: () => {
        setIsAuth(true);
      },
      onError: () => {
        message.error({
          message: "Unlock failed, please confirm the password is correct",
        });
      },
    },
  );

  const onEnter = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.code === "Enter") {
        onUnlock();
      }
    },
    [onUnlock],
  );

  const { run: onReset, loading: resetLoading } = useRequest(
    async () => {
      const isContinue = await new Promise((resolve) => {
        modal.confirm({
          title: <span>Warning</span>,
          content:
            "All application data will be reset soon, whether to continue",
          onOk: () => {
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      });

      if (!isContinue) {
        return;
      }

      return resetCrypto();
    },
    {
      manual: true,
      onError: () => {
        message.error({
          message: "Reset application failed",
        });
      },
    },
  );

  const loading = loadCryptoLoading || resetLoading;

  return (
    <div className={styles.root}>
      <div className={styles.panel}>
        <Loading loading={loading} size={48}>
          <h2 className={styles.title}>
            Enter your password to unlock application data
          </h2>
          <div className={styles.passwordWrap}>
            <TextFieldPassword
              fullWidth
              placeholder="Please enter the password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={onEnter}
            ></TextFieldPassword>
          </div>
          <div className={styles.actions}>
            <Button className={styles.actionButton} onClick={onUnlock}>
              Unlock
            </Button>
            <Button
              className={styles.actionButton}
              color="red"
              onClick={onReset}
            >
              Reset APP
            </Button>
          </div>
        </Loading>
      </div>
    </div>
  );
}
