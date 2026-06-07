import { Progress } from "@radix-ui/themes";
import { get } from "lodash-es";
import type { CSSProperties } from "react";

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

type SSHLoadingProps = {
  sx?: CSSProperties | Array<CSSProperties | undefined>;
  command?: string;
} & ErrorProps;

export function SSHLoading({
  host,
  loading,
  error,
  sx,
  command,
  onReConnect,
  onReAuth,
  onRetry,
  onClose,
  onOpenAddKey,
}: SSHLoadingProps) {
  const errorType = get(error as never, "type") as keyof typeof STATUS_BUTTONS;

  const render = STATUS_BUTTONS[errorType] || STATUS_BUTTONS.default;
  const rootStyle = Array.isArray(sx)
    ? Object.assign({}, ...sx.filter(Boolean))
    : sx;

  return (
    <div className={styles.root} style={rootStyle}>
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
                error,
                onReConnect,
                onReAuth,
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
