import { type ReactNode } from 'react';
import {
  Box,
  Divider,
  Drawer,
  Icon,
  IconButton,
  Typography,
} from '@mui/material';
import { Loading } from 'shared';

import { TITLE_BAR_HEIGHT } from '@/constants/titleBar';

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
  return (
    <Drawer
      open={open}
      anchor="right"
      sx={{
        '& .MuiDrawer-paper': {
          width: 420,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          mt: `${TITLE_BAR_HEIGHT}px`,
        }}
      >
        <Typography variant="h6">{title}</Typography>
        {!loading && (
          <IconButton size="small" onClick={onCancel}>
            <Icon className="icon-arrow-right" />
          </IconButton>
        )}
      </Box>
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
