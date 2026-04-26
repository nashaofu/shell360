import { Button, Heading, Spinner, Text } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { type KeyboardEvent, useCallback, useState } from "react";
import { LockIcon, TextFieldPassword } from "shared";
import { loadCryptoByPassword, resetCrypto } from "tauri-plugin-data";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import styles from "./index.module.less";

export default function Unlock() {
  const [password, setPassword] = useState("");
  const message = useMessage();
  const modal = useModal();

  const { run: onUnlock, loading: loadCryptoLoading } = useRequest(
    () => loadCryptoByPassword({ password }),
    {
      manual: true,
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
        {loading && (
          <div className={styles.overlay}>
            <Spinner size="3" />
          </div>
        )}
        <div className={styles.iconWrap}>
          <LockIcon />
        </div>
        <Heading size="5" align="center" as="h2">
          Application Locked
        </Heading>
        <Text
          as="p"
          size="2"
          align="center"
          color="gray"
          className={styles.hint}
        >
          Enter your password to unlock
        </Text>
        <div className={styles.passwordWrap}>
          <TextFieldPassword
            fullWidth
            placeholder="Please enter the password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={onEnter}
            disabled={loading}
          />
        </div>
        <div className={styles.actions}>
          <Button
            style={{ width: "100%" }}
            onClick={onUnlock}
            disabled={loading}
          >
            {loadCryptoLoading && <Spinner />}
            {loadCryptoLoading ? "Unlocking..." : "Unlock"}
          </Button>
        </div>
        <div className={styles.resetWrap}>
          <Button
            variant="ghost"
            color="gray"
            size="1"
            onClick={onReset}
            disabled={loading}
          >
            Reset all data
          </Button>
        </div>
      </div>
    </div>
  );
}
