import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Box, Theme, alpha, styled,
} from '@mui/material';

import { TITLE_BAR_HEIGHT } from '@/constants/titleBar';
import { useColorsAtomValue } from '@/atom/colorsAtom';

const TitleBarButton = styled(Box)(() => ({
  width: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  cursor: 'pointer',
}));

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const colorsAtomValue = useColorsAtomValue();

  const onClickMinimize = useCallback(() => {
    getCurrentWindow().minimize();
  }, []);

  const onClickToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize();
  }, []);

  const onClickClose = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  const buttonSx = useMemo(() => {
    const { bgColor } = colorsAtomValue;
    const backgroundColor = ({ palette }: Theme) => alpha(palette.getContrastText(bgColor), 0.07);

    return {
      height: TITLE_BAR_HEIGHT,
      '&:hover': {
        backgroundColor,
      },
    };
  }, [colorsAtomValue]);

  useEffect(() => {
    getCurrentWindow().isMaximized().then(setIsMaximized);

    const unListen = getCurrentWindow().onResized(() => {
      getCurrentWindow().isMaximized().then(setIsMaximized);
    });

    return () => {
      unListen.then((fn) => fn());
    };
  }, []);

  return (
    <Box
      sx={{
        height: TITLE_BAR_HEIGHT,
        bgcolor: 'transparent',
        color: colorsAtomValue.titleBarColor,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
        data-tauri-drag-region="true"
      />
      {__TAURI_PLATFORM__ !== 'darwin' && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            position: 'relative',
            zIndex: 10,
            appRegion: 'no-drag',
          }}
        >
          <TitleBarButton sx={buttonSx} onClick={onClickMinimize}>
            <span className="icon-window-minimize" />
          </TitleBarButton>
          <TitleBarButton sx={buttonSx} onClick={onClickToggleMaximize}>
            {isMaximized ? (
              <span className="icon-window-restore" />
            ) : (
              <span className="icon-window-maximize" />
            )}
          </TitleBarButton>
          <TitleBarButton sx={buttonSx} onClick={onClickClose}>
            <span className="icon-window-close" />
          </TitleBarButton>
        </Box>
      )}
    </Box>
  );
}
