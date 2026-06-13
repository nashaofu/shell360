import {
  Button,
  Callout,
  Flex,
  IconButton,
  Progress,
  Spinner,
} from "@radix-ui/themes";
import type { CSSProperties } from "react";
import { CloseIcon } from "shared";
import styles from "./Loading.module.less";

type LocalTerminalLoadingProps = {
  loading: boolean;
  error?: Error | string | null;
  onRetry: () => void;
  onClose?: () => void;
  sx?: CSSProperties;
};

export function LocalTerminalLoading({
  loading,
  error,
  onRetry,
  onClose,
  sx,
}: LocalTerminalLoadingProps) {
  return (
    <div className={styles.root} style={sx}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>Local Terminal</div>
          {onClose && (
            <IconButton variant="ghost" color="gray" size="1" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </div>
        <div className={styles.progressWrap}>
          <Progress
            value={error ? 100 : null}
            color={error ? "red" : undefined}
          />
        </div>
        {loading && !error && (
          <Flex align="center" justify="center" gap="2" p="4">
            <Spinner />
            <span>Starting shell...</span>
          </Flex>
        )}
        {error && (
          <div className={styles.errorSection}>
            <Callout.Root color="red">
              <Callout.Text>
                {typeof error === "string"
                  ? error
                  : (error?.message ?? "Failed to start shell")}
              </Callout.Text>
            </Callout.Root>
            <Flex justify="center" mt="3">
              <Button onClick={onRetry} variant="soft">
                Retry
              </Button>
            </Flex>
          </div>
        )}
      </div>
    </div>
  );
}
