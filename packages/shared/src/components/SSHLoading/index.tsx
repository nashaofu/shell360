import { Progress } from "@radix-ui/themes";
import { getHostName } from "@/utils/host";

import { HostIcon } from "../Icon";
import { Loading } from "../Loading";
import AuthenticationError from "./AuthenticationError";
import type { ErrorProps } from "./common";
import DefaultError from "./DefaultError";
import styles from "./styles.module.less";
import UnknownKey from "./UnknownKey";

const STATUS_BUTTONS = {
  ConnectFailed: DefaultError,
  UnknownKey: UnknownKey,
  AuthenticationError: AuthenticationError,
  default: DefaultError,
};

const NATIVE_ERROR_TYPES = {
  SSH_UNKNOWN_SERVER_KEY: "UnknownKey",
  SSH_AUTHENTICATION_FAILED: "AuthenticationError",
  SSH_KEYBOARD_INTERACTIVE_REQUIRED: "AuthenticationError",
} as const;

type SSHLoadingProps = {
  className?: string;
  command?: string;
} & ErrorProps;

export function SSHLoading({
  host,
  loading,
  error,
  className,
  command,
  onReConnect,
  onReAuth,
  onSubmitKeyboardInteractive,
  onRetry,
  onClose,
  onOpenAddKey,
}: SSHLoadingProps) {
  const errorRecord =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          details?: unknown;
          message?: unknown;
          type?: unknown;
        })
      : undefined;
  const nativeErrorCode =
    typeof errorRecord?.code === "string" ? errorRecord.code : undefined;
  const nativeErrorType =
    nativeErrorCode &&
    NATIVE_ERROR_TYPES[nativeErrorCode as keyof typeof NATIVE_ERROR_TYPES];
  const errorType =
    typeof errorRecord?.type === "string"
      ? (errorRecord.type as keyof typeof STATUS_BUTTONS)
      : nativeErrorType;
  const errorDetails = errorRecord?.details;
  const normalizedError =
    errorDetails && typeof errorDetails === "object"
      ? {
          ...errorDetails,
          type: errorType,
          message:
            typeof errorRecord.message === "string"
              ? errorRecord.message
              : String(error),
        }
      : error;

  const render =
    (errorType && STATUS_BUTTONS[errorType]) || STATUS_BUTTONS.default;
  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.hostIcon}>
            <HostIcon />
          </div>
          <div className={styles.hostText}>
            <div className={styles.hostName}>{getHostName(host)}</div>
            <div
              className={styles.hostCommand}
            >{`${command ?? `ssh ${host.username}@${host.hostname} -p ${host.port}`}`}</div>
          </div>
        </div>
        <div className={styles.progressWrap}>
          <Progress
            value={error ? 100 : null}
            color={error ? "red" : undefined}
          />
        </div>
        {!!error && (
          <div className={styles.errorSection}>
            <Loading loading={loading}>
              {render({
                host,
                loading,
                error: normalizedError,
                onReConnect,
                onReAuth,
                onSubmitKeyboardInteractive,
                onRetry,
                onClose,
                onOpenAddKey,
              })}
            </Loading>
          </div>
        )}
      </div>
    </div>
  );
}
