import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Box,
  Button,
  ClickAwayListener,
  Divider,
  Drawer,
  Icon,
  IconButton,
  ThemeProvider,
  createTheme,
  useTheme,
} from '@mui/material';
import { lightGreen } from '@mui/material/colors';
import { useNavigate } from 'react-router-dom';

import { TITLE_BAR_HEIGHT } from '@/constants/titleBar';

import Terminals from './Terminals';
import Menus from './Menus';
import Logo from './Logo';

const MINI_WINDOW_WIDTH = 720;

export default function Sidebar() {
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const isMiniWindow = windowWidth < MINI_WINDOW_WIDTH;
  const [expand, setExpand] = useState(() => !isMiniWindow);
  const navigate = useNavigate();

  const drawerWidth = useMemo(() => {
    if (isMiniWindow) {
      return 70;
    }

    return expand ? 240 : 70;
  }, [expand, isMiniWindow]);

  const globalTheme = useTheme();
  const sidebarTheme = useMemo(
    () => createTheme(globalTheme, {
      palette: {
        primary: {
          main: '#fff',
        },
        text: {
          primary: '#fff',
        },
        divider: 'rgba(255, 255, 255, 0.12)',
        background: {
          paper: '#2c2c2c',
          default: '#2c2c2c',
        },
        success: globalTheme.palette.augmentColor({
          color: {
            main: lightGreen['700'],
          },
        }),
        action: {
          active: '#fff',
          hover: 'rgba(255, 255, 255, 0.08)',
          hoverOpacity: 0.08,
          selected: 'rgba(255, 255, 255, 0.16)',
          selectedOpacity: 0.16,
          disabled: 'rgba(255, 255, 255, 0.3)',
          disabledBackground: 'rgba(255, 255, 255, 0.12)',
          disabledOpacity: 0.38,
          focus: 'rgba(255, 255, 255, 0.12)',
          focusOpacity: 0.12,
          activatedOpacity: 0.24,
        },
      },
    }),
    [globalTheme],
  );

  const onClickAway = useCallback(() => {
    if (isMiniWindow) {
      setExpand(false);
    }
  }, [isMiniWindow]);

  useEffect(() => {
    const onResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth < MINI_WINDOW_WIDTH) {
        setExpand(false);
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <ThemeProvider theme={sidebarTheme}>
      <ClickAwayListener onClickAway={onClickAway}>
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: expand ? 240 : 70,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
          open={expand}
          variant="permanent"
          anchor="left"
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: expand ? 'row' : 'column',
              alignItems: 'center',
              // 顶部 TitleBar 的高度
              mt: `${TITLE_BAR_HEIGHT}px`,
              px: 2,
              py: 1,
              gap: 1,
            }}
          >
            <Logo expand={expand} />
            <IconButton
              size="small"
              onClick={() => navigate('/settings', { replace: true })}
            >
              <Icon className="icon-settings" />
            </IconButton>
          </Box>

          <Divider />

          <Menus expand={expand} />

          <Divider />

          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
            }}
          >
            <Terminals expand={expand} />
          </Box>

          <Divider />

          <Button
            variant="text"
            size="large"
            sx={{
              width: '100%',
              flexShrink: 0,
            }}
            onClick={() => setExpand((val) => !val)}
          >
            {expand ? (
              <Icon className="icon-arrow-left" />
            ) : (
              <Icon className="icon-arrow-right" />
            )}
          </Button>
        </Drawer>
      </ClickAwayListener>
    </ThemeProvider>
  );
}
