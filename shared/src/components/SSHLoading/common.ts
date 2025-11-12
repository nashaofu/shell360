import { Button, styled, type ButtonProps } from '@mui/material';
import type { ComponentType } from 'react';
import type { Host } from 'tauri-plugin-data';
import type { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';

export type ErrorProps = {
  host: Host;
  error?: unknown;
  onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => unknown;
  onReAuth: (host: Host) => void;
  onRetry: () => void;
  onClose: () => void;
  onOpenAddKey: () => void;
};

export const StatusButton: ComponentType<ButtonProps> = styled(Button, {
  name: 'StatusButton',
})(() => ({
  minWidth: 150,
}));
