import { type SxProps, type Theme } from '@mui/material';
import { type ReactNode } from 'react';

export enum SftpTableOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export type SftpTableCell<T extends Record<string, unknown>> = {
  id: string;
  key: keyof T;
  title: ReactNode;
  align?: 'inherit' | 'left' | 'center' | 'right' | 'justify';
  compare?: (a: T, b: T) => number;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  sx?: ((isHeader: boolean) => SxProps<Theme>);
  render: (item: T, index: number) => ReactNode;
};
