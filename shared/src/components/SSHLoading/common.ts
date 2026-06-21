import { Button } from "@radix-ui/themes";
import { createElement, type ReactNode } from "react";
import type { Host } from "tauri-plugin-data";
import type { SSHSessionCheckServerKey } from "tauri-plugin-ssh";
import styles from "./styles.module.less";

export type ErrorProps = {
  host: Host;
  loading?: boolean;
  error?: unknown;
  onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => unknown;
  onReAuth: (host: Host) => unknown;
  onSubmitKeyboardInteractive?: (answers: string[]) => unknown;
  onRetry: () => unknown;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

type StatusButtonProps = {
  variant?: "outlined" | "contained";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => unknown;
};

export function StatusButton({
  variant = "contained",
  type = "button",
  disabled,
  children,
  onClick,
}: StatusButtonProps) {
  return createElement(
    Button,
    {
      className: styles.statusButton,
      variant: variant === "outlined" ? "outline" : "solid",
      type,
      disabled,
      onClick,
    },
    children,
  );
}
