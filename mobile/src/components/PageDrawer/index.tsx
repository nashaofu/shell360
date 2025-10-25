import { type ReactNode, useEffect } from 'react';
import {
  Box,
  Divider,
  Icon,
  IconButton,
  Drawer,
  Toolbar,
  Typography,
} from '@mui/material';
import { Loading } from 'shared';

import overlay from '@/utils/overlay';

type PageDrawerProps = {
  loading?: boolean;
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onCancel: () => unknown;
};

export default function PageDrawer({
  loading,
  open,
  title,
  children,
  footer,
  onCancel,
}: PageDrawerProps) {
  useEffect(() => {
    if (open) {
      overlay.add(onCancel);
    } else {
      overlay.delete(onCancel);
    }

    return () => {
      overlay.delete(onCancel);
    };
  }, [onCancel, open]);

  return (
    <Drawer
      open={open}
      anchor="right"
      sx={(theme) => ({
        '& .MuiDrawer-paper': {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          [theme.breakpoints.down('sm')]: {
            width: '100%',
          },
          [theme.breakpoints.up('sm')]: {
            width: 420,
          },
        },
      })}
    >
      <Toolbar>
        <IconButton
          edge="start"
          sx={(theme) => ({
            mr: 2,
            [theme.breakpoints.up('sm')]: {
              display: 'none',
            },
          })}
          disabled={loading}
          onClick={onCancel}
        >
          <Icon className="icon-arrow-left" />
        </IconButton>
        <Typography
          sx={{
            flex: 1,
          }}
          variant="h6"
        >
          {title}
        </Typography>
        <IconButton
          edge="end"
          sx={(theme) => ({
            ml: 2,
            [theme.breakpoints.down('sm')]: {
              display: 'none',
            },
          })}
          disabled={loading}
          onClick={onCancel}
        >
          <Icon className="icon-close" />
        </IconButton>
      </Toolbar>
      <Divider />
      <Loading
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        loading={loading}
        size={32}
      >
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            px: 2,
            py: 2.5,
          }}
        >
          {children}
        </Box>
      </Loading>
      {footer && (
        <>
          <Divider />
          <Box
            sx={{
              p: 2,
            }}
          >
            {footer}
          </Box>
        </>
      )}
    </Drawer>
  );
}
