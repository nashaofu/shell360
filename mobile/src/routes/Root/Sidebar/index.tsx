import {
  Avatar,
  Box,
  Divider,
  Icon,
  IconButton,
  SwipeableDrawer,
} from '@mui/material';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGlobalStateAtomWithApi } from '@/atom/globalState';
import overlay from '@/utils/overlay';

import Terminals from './Terminals';
import logo from './logo.svg';
import Menus from './Menus';

export default function Sidebar() {
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();

  const navigate = useNavigate();

  const goSettings = useCallback(() => {
    navigate('/settings', { replace: true });
    globalStateAtomWithApi.closeSidebar();
  }, [globalStateAtomWithApi, navigate]);

  useEffect(() => {
    if (globalStateAtomWithApi.isOpenSidebar) {
      overlay.add(globalStateAtomWithApi.closeSidebar);
    } else {
      overlay.delete(globalStateAtomWithApi.closeSidebar);
    }

    return () => {
      overlay.delete(globalStateAtomWithApi.closeSidebar);
    };
  }, [
    globalStateAtomWithApi.isOpenSidebar,
    globalStateAtomWithApi.closeSidebar,
  ]);

  return (
    <SwipeableDrawer
      sx={{
        width: 300,
        '& .MuiDrawer-paper': {
          width: 300,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      }}
      open={globalStateAtomWithApi.isOpenSidebar}
      anchor="left"
      onClose={globalStateAtomWithApi.closeSidebar}
      onOpen={globalStateAtomWithApi.openSidebar}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          mt: 2,
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
          }}
        >
          <Avatar src={logo} alt="logo" />
          <Box
            sx={{
              fontSize: 16,
              pl: 1,
            }}
          >
            Shell360
          </Box>
        </Box>
        <IconButton size="small" onClick={goSettings}>
          <Icon className="icon-settings" />
        </IconButton>
      </Box>

      <Divider />

      <Menus onClick={globalStateAtomWithApi.closeSidebar} />

      <Divider />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <Terminals onClick={globalStateAtomWithApi.closeSidebar} />
      </Box>
    </SwipeableDrawer>
  );
}
