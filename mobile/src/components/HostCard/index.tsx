import type { Host } from "bridge/data";
import type { KeyboardEvent, ReactNode } from "react";

import { getHostDesc, getHostName } from "shared";
import styles from "./index.module.less";

export type ConnectionErrorInfo = {
  message?: string;
  onRetry: () => void;
};

type HostCardProps = {
  host: Host;
  onOpenSsh: () => void;
  onOpenSftp: () => void;
  onOpenDetails: () => void;
  actions?: ReactNode;
  sshPending?: boolean;
  sftpPending?: boolean;
  sshError?: ConnectionErrorInfo;
  sftpError?: ConnectionErrorInfo;
};

export default function HostCard({
  host,
  onOpenSsh,
  onOpenSftp,
  onOpenDetails,
  actions,
  sshPending,
  sftpPending,
  sshError,
  sftpError,
}: HostCardProps) {
  const title = getHostName(host);
  const initials = title.slice(0, 2).toUpperCase();

  const sshLabel = sshPending ? "Connecting…" : sshError ? "Failed" : "SSH";
  const sftpLabel = sftpPending ? "Connecting…" : sftpError ? "Failed" : "SFTP";

  const renderActionBtn = (
    label: string,
    onClick: () => void,
    isSsh: boolean,
    disabled: boolean,
    error?: ConnectionErrorInfo,
  ) => (
    <button
      type="button"
      className={`${isSsh ? styles.sshBtn : styles.sftpBtn}${error ? ` ${styles.errorBtn}` : ""}`}
      onClick={error ? error.onRetry : onClick}
      disabled={disabled && !error}
      aria-label={`${label} for ${title}`}
    >
      {label}
    </button>
  );

  const onInfoKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetails();
    }
  };

  return (
    <div className={styles.card}>
      <div
        role="button"
        tabIndex={0}
        className={styles.info}
        onClick={onOpenDetails}
        onKeyDown={onInfoKeyDown}
        aria-label={`Open ${title}`}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.infoMain}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{title}</span>
            <span className={styles.statusDot} aria-hidden="true" />
          </span>
          <span className={styles.address}>{getHostDesc(host)}</span>
          <span className={styles.meta}>{host.tags?.join(" · ") ?? ""}</span>
        </span>
        {actions && <span className={styles.more}>{actions}</span>}
      </div>

      {(sshError?.message || sftpError?.message) && (
        <span className={styles.errorText}>
          {sshError?.message || sftpError?.message || "Connection failed"}
        </span>
      )}

      <div className={styles.actions}>
        {renderActionBtn(sshLabel, onOpenSsh, true, !!sshPending, sshError)}
        {renderActionBtn(
          sftpLabel,
          onOpenSftp,
          false,
          !!sftpPending,
          sftpError,
        )}
      </div>
    </div>
  );
}
