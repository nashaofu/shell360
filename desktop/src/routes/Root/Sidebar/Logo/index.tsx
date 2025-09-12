import { Avatar, Box } from '@mui/material';

import { useUpdateAtom } from '@/atom/updateAtom';

import logo from './logo.svg';

type LogoProps = {
  expand?: boolean;
};

export default function Logo({ expand }: LogoProps) {
  const { update, setOpenUpdateDialog } = useUpdateAtom();

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          position: 'relative',
        }}
      >
        <Avatar src={logo} alt="logo" />
        {!!update?.available && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              top: '14%',
              right: '14%',
              zIndex: 1,
              width: expand ? 'auto' : 12,
              height: expand ? 20 : 12,
              transform: 'scale(0.92) translate3d(50%, -50%, 0)',
              transformOrigin: '100% 0%',
              backgroundColor: (theme) => theme.palette.success.main,
              color: (theme) => theme.palette.success.contrastText,
              fontSize: 12,
              borderRadius: 10,
              padding: expand ? [0, 0.8] : 0,
              cursor: 'pointer',
            }}
            onClick={() => setOpenUpdateDialog(true)}
          >
            {expand && 'NEW'}
          </Box>
        )}
      </Box>
      {expand && (
        <Box
          sx={{
            fontSize: 16,
            pl: 1,
          }}
        >
          Shell360
        </Box>
      )}
    </Box>
  );
}
