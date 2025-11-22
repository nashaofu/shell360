import { Suspense, useLayoutEffect, useMemo } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAtomValue } from 'jotai';
import {
  TERMINAL_THEMES,
  TERMINAL_THEMES_MAP,
  useHosts,
  useKeys,
  usePortForwardings,
  useTerminalsAtomValue,
} from 'shared';

import { TITLE_BAR_HEIGHT } from '@/constants/titleBar';
import { useColorsAtomWithApi } from '@/atom/colorsAtom';
import { themeAtom } from '@/atom/themeAtom';

import Sidebar from '../Sidebar';
import Terminals from '../Terminals';

export default function Content() {
  const match = useMatch('/terminal/:uuid');
  const isShowTerminal = !!match?.params.uuid;
  const terminals = useTerminalsAtomValue();
  const colorsAtomWithApi = useColorsAtomWithApi();

  const themeValue = useAtomValue(themeAtom);

  useHosts();
  useKeys();
  usePortForwardings();

  const activeTerminal = useMemo(
    () => terminals.get(match?.params.uuid as string),
    [terminals, match?.params.uuid]
  );

  useLayoutEffect(() => {
    const defaultBackground = themeValue.palette.background.default;
    const theme =
      TERMINAL_THEMES_MAP.get(
        activeTerminal?.host.terminalSettings?.theme as string
      ) ?? TERMINAL_THEMES[0];

    const isLoading =
      activeTerminal?.jumpHostChain.some(
        (it) => it.status !== 'authenticated' || it.loading || it.error
      ) || activeTerminal?.status !== 'success';

    const bgColor = isLoading
      ? defaultBackground
      : theme.theme.background ?? defaultBackground;

    colorsAtomWithApi.setColors({
      bgColor,
      titleBarColor: themeValue.palette.getContrastText(bgColor),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeValue.palette, activeTerminal]);

  return (
    <>
      <Sidebar />
      <Box
        sx={{
          flexGrow: 1,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          mt: `${TITLE_BAR_HEIGHT}px`,
        }}
      >
        <Box
          sx={{
            display: !isShowTerminal ? 'flex' : 'none',
            flexDirection: 'column',
            /**
             * 绝对定位，保证子元素不会超出容器
             * 可以尝试去掉定位，并改为flex布局
             * 然后当Keys页面卡片内容比较长时
             * 页面会一直抖动，且页面宽度会不断增长
             */
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            overflow: 'hidden',
          }}
        >
          <Suspense>
            <Outlet />
          </Suspense>
        </Box>
        <Box
          sx={{
            display: isShowTerminal ? 'flex' : 'none',
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            overflow: 'hidden',
          }}
        >
          <Terminals />
        </Box>
      </Box>
    </>
  );
}
