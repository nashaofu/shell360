import { Button, Flex } from "@radix-ui/themes";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { get } from "lodash-es";
import { useCallback } from "react";
import styles from "./index.module.less";

type AbnormalProps = {
  error?: unknown;
  resetErrorBoundary?: () => unknown;
};

export default function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: AbnormalProps) {
  const onReset = useCallback(async () => {
    const answer = await ask(
      "This operation will clear all app configurations, are you sure you want to continue?",
      {
        title: "Warning",
        kind: "warning",
      },
    );

    if (answer) {
      window.localStorage.clear();
      window.location.reload();
    }
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.eyesWrap}>
        <div className={styles.eyes}>
          <span className={styles.eye}>
            <span className={styles.eyeball} />
          </span>
          <span className={styles.eye}>
            <span className={styles.eyeball} />
          </span>
        </div>
      </div>
      <div className={styles.titleWrap}>
        <h1 className={styles.title}>Oops!</h1>
      </div>
      <div className={styles.messageWrap}>
        <p className={styles.message}>{get(error, "message", String(error))}</p>
      </div>
      <Flex
        align="center"
        justify="center"
        gap="3"
        style={{ maxWidth: 420, margin: "0 auto" }}
      >
        <Button style={{ flex: 1 }} onClick={resetErrorBoundary}>
          Retry
        </Button>
        <Button style={{ flex: 1 }} color="red" onClick={onReset}>
          Reset
        </Button>
        <Button
          style={{ flex: 1 }}
          color="amber"
          onClick={() => getCurrentWindow().close()}
        >
          Exit
        </Button>
      </Flex>
    </div>
  );
}
