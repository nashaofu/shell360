import { type ReactNode } from 'react';
import {
  AppBar,
  Box,
  Icon,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';

import { useGlobalStateAtomWithApi } from '@/atom/globalState';

type PageProps = {
  title: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
};

export default function Page({ title, headerRight, children }: PageProps) {
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();

  return (
    <>
      <AppBar position="static" sx={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            sx={{
              color: 'inherit',
              mr: 2,
            }}
            onClick={globalStateAtomWithApi.openSidebar}
          >
            <Icon className="icon-menu" />
          </IconButton>
          <Typography
            sx={{
              flex: 1,
            }}
            variant="h6"
          >
            {title}
          </Typography>
          {headerRight}
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          flexGrow: 1,
          px: 2,
          py: 1,
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
      </Box>
    </>
  );
}
