import { Button } from "@radix-ui/themes";
import { createElement, type ReactNode } from "react";
import type { Host } from "tauri-plugin-data";
import type { SSHSessionCheckServerKey } from "tauri-plugin-ssh";

export type ErrorProps = {
  host: Host;
  loading?: boolean;
  error?: unknown;
  onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => unknown;
  onReAuth: (host: Host) => unknown;
  onRetry: () => unknown;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

type StatusButtonProps = {
  variant?: "outlined" | "contained";
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => unknown;
};

export function StatusButton({
  variant = "contained",
  disabled,
  children,
  onClick,
}: StatusButtonProps) {
  return createElement(
    Button,
    {
      style: { minWidth: 150 },
      variant: variant === "outlined" ? "outline" : "solid",
      disabled,
      onClick,
    },
    children,
  );
}
