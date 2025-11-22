import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  createTheme,
  Icon,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
  useTheme,
  darken,
} from '@mui/material';
import { TERMINAL_THEMES_MAP, Dropdown } from 'shared';
import { type TerminalAtom, useTerminalsAtomWithApi } from 'shared';

import SSHTerminal from '@/components/SSHTerminal';
import { useGlobalStateAtomWithApi } from '@/atom/globalState';
import AddKey from '@/components/AddKey';

export default function Terminals() {
  const match = useMatch('/terminal/:uuid');
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();
  const globalTheme = useTheme();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

  const activeTerminal = useMemo(
    () => terminalsAtomWithApi.state.get(match?.params.uuid as string),
    [match?.params.uuid, terminalsAtomWithApi.state]
  );

  const onClose = useCallback(
    (item: TerminalAtom) => {
      const [, map] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const first = map.values().next().value;
        if (first) {
          navigate(`/terminal/${first.uuid}`, {
            replace: true,
          });
        } else {
          navigate('/', {
            replace: true,
          });
        }
      }
    },
    [match?.params.uuid, navigate, terminalsAtomWithApi]
  );

  const headerRightMenus = useMemo(
    () => [
      {
        label: 'Close',
        value: 'Close',
        onClick: () => {
          if (activeTerminal) {
            onClose(activeTerminal);
          }
        },
      },
    ],
    [activeTerminal, onClose]
  );

  const appBarTheme = useMemo(() => {
    if (!activeTerminal) {
      return globalTheme;
    }

    const isLoading =
      activeTerminal?.jumpHostChain.some(
        (it) => it.status !== 'authenticated' || it.loading || it.error
      ) || activeTerminal?.status !== 'success';

    if (isLoading) {
      return globalTheme;
    }

    const defaultBackground = globalTheme.palette.background.default;
    const theme = TERMINAL_THEMES_MAP.get(
      activeTerminal.host.terminalSettings?.theme
    );

    const bgColor = darken(theme?.theme.background ?? defaultBackground, 0.52);

    return createTheme({
      palette: {
        mode: globalTheme.palette.mode,
        text: {
          primary: globalTheme.palette.getContrastText(bgColor),
        },
        background: {
          paper: bgColor,
          default: bgColor,
        },
      },
    });
  }, [activeTerminal, globalTheme]);

  useEffect(() => {
    if (!terminalsAtomWithApi.state.size && match) {
      navigate('/', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalsAtomWithApi.state.size, navigate]);

  return (
    <Box
      sx={{
        flexGrow: 1,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ThemeProvider theme={appBarTheme}>
        <AppBar
          position="static"
          sx={{
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
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
              {activeTerminal?.name || 'Shell360'}
            </Typography>
            <Dropdown menus={headerRightMenus}>
              {({ onChangeOpen }) => (
                <IconButton
                  sx={{
                    ml: 2,
                    color: 'inherit',
                  }}
                  edge="end"
                  size="small"
                  onClick={(event) => onChangeOpen(event.currentTarget)}
                >
                  <Icon className="icon-more" />
                </IconButton>
              )}
            </Dropdown>
          </Toolbar>
        </AppBar>
      </ThemeProvider>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const visible = match?.params.uuid === item.uuid;
        return (
          <SSHTerminal
            key={item.uuid}
            sx={{
              display: visible ? 'flex' : 'none',
              flexGrow: 1,
              flexShrink: 0,
            }}
            item={item}
            onClose={() => onClose(item)}
            onOpenAddKey={() => setAddKeyOpen(true)}
          />
        );
      })}
      <AddKey
        open={addKeyOpen}
        onCancel={() => setAddKeyOpen(false)}
        onOk={() => setAddKeyOpen(false)}
      />
    </Box>
  );
}
