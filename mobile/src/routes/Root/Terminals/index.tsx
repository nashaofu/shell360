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

import SSHTerminal from '@/components/SSHTerminal';
import {
  type TerminalAtom,
  useTerminalsAtomWithApi,
} from '@/atom/terminalsAtom';
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
    () =>
      terminalsAtomWithApi.state.find(
        (item) => item.uuid === match?.params.uuid
      ),
    [match?.params.uuid, terminalsAtomWithApi.state]
  );

  const onLoadingChange = useCallback(
    (item: TerminalAtom, loading: boolean) => {
      terminalsAtomWithApi.update({
        ...item,
        loading,
      });
    },
    [terminalsAtomWithApi]
  );

  const onClose = useCallback(
    (item: TerminalAtom) => {
      const [, items] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const first = items[0];
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

    if (activeTerminal.loading) {
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
    if (!terminalsAtomWithApi.state.length) {
      navigate('/', { replace: true });
    }
  }, [terminalsAtomWithApi, navigate]);

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
      {terminalsAtomWithApi.state.map((item) => {
        const visible = match?.params.uuid === item.uuid;
        return (
          <SSHTerminal
            key={item.uuid}
            sx={{
              display: visible ? 'flex' : 'none',
              flexGrow: 1,
              flexShrink: 0,
            }}
            host={item.host}
            onLoadingChange={(loading) => onLoadingChange(item, loading)}
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
