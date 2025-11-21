import { Button, styled, type ButtonProps } from '@mui/material';
import type { ComponentType } from 'react';
import type { Host } from 'tauri-plugin-data';
import type { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';

export type ErrorProps = {
  host: Host;
  error?: unknown;
  onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => unknown;
  onReAuth: (host: Host) => unknown;
  onRetry: () => unknown;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

export const StatusButton: ComponentType<ButtonProps> = styled(Button, {
  name: 'StatusButton',
})(() => ({
  minWidth: 150,
}));
