import {
  Box,
  Button,
  ButtonProps,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentProps,
  DialogProps,
  DialogTitle,
  ThemeProvider,
} from '@mui/material';
import { ReactNode } from 'react';
import { useAtomValue } from 'jotai';

import { themeAtom } from '@/atom/themeAtom';

export type HookModalProps = {
  open: boolean;
  icon?: ReactNode;
  title?: ReactNode;
  content?: ReactNode;
  DialogProps?: Omit<DialogProps, 'open' | 'onCancel'>;
  DialogContentProps?: Omit<DialogContentProps, 'children'>;
  hideCancel?: boolean;
  cancelText?: ReactNode;
  CancelButtonProps?: Omit<ButtonProps, 'children' | 'onClick'>;
  hideOk?: boolean;
  okText?: ReactNode;
  OkButtonProps?: Omit<ButtonProps, 'children' | 'onClick'>;
  onCancel?: () => unknown;
  onOk?: () => unknown;
};

export default function HookModal({
  open,
  icon,
  title,
  content,
  DialogProps: HookDialogProps,
  DialogContentProps: HookDialogContentProps,
  hideCancel,
  cancelText,
  CancelButtonProps,
  hideOk,
  okText,
  OkButtonProps,
  onCancel,
  onOk,
}: HookModalProps) {
  const theme = useAtomValue(themeAtom);
  const { maxWidth = 'xs', ...dialogProps } = HookDialogProps || {};
  const { sx, ...dialogContentProps } = HookDialogContentProps || {};

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        {...dialogProps}
        maxWidth={maxWidth}
        open={open}
        onClose={onCancel}
        sx={{
          '.MuiDialog-container': {
            paddingTop: 'env(safe-area-inset-top)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon && (
            <Box
              sx={{
                mr: 1,
              }}
            >
              {icon}
            </Box>
          )}
          {title}
        </DialogTitle>
        <DialogContent
          {...dialogContentProps}
          sx={[
            {
              userSelect: 'text',
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          {content}
        </DialogContent>
        <DialogActions>
          {!hideCancel && (
            <Button {...CancelButtonProps} onClick={onCancel}>
              {cancelText || 'Cancel'}
            </Button>
          )}
          {!hideOk && (
            <Button {...OkButtonProps} onClick={onOk}>
              {okText || 'Ok'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
