import { Box } from '@mui/material';

import { TITLE_BAR_Z_INDEX } from '@/constants/titleBar';
import { useColorsAtomWithApi } from '@/atom/colorsAtom';

import TitleBar from './Titlebar';
import Auth from './Auth';
import Content from './Content';

export default function Root() {
  const colorsAtomWithApi = useColorsAtomWithApi();

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        bgcolor: colorsAtomWithApi.colors.bgColor,
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: 0,
          zIndex: TITLE_BAR_Z_INDEX,
        }}
      >
        <TitleBar />
      </Box>
      <Auth>
        <Content></Content>
      </Auth>
    </Box>
  );
}
