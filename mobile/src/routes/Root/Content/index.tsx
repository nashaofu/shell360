import { Suspense } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { Box } from '@mui/material';

import Sidebar from '../Sidebar';
import Terminals from '../Terminals';
import Subscription from '../Subscription';

export default function Content() {
  const match = useMatch('/terminal/:uuid');
  const isShowTerminal = !!match?.params.uuid;

  return (
    <>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          overflow: 'hidden',
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
      <Sidebar />
      {import.meta.env.TAURI_PLATFORM === 'ios' && <Subscription />}
    </>
  );
}
