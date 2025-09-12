import { Box, CircularProgress } from '@mui/material';
import { ReactNode } from 'react';
import { useAtomValue } from 'jotai';

import { authAtom } from '@/atom/authAtom';
import { cryptoIsEnableAtom } from '@/atom/cryptoAtom';

import UnlockCrypto from './UnlockCrypto';

export interface AuthProps {
  children: ReactNode;
}

export default function Auth({ children }: AuthProps) {
  const isAuthed = useAtomValue(authAtom);
  const cryptoIsEnable = useAtomValue(cryptoIsEnableAtom);

  if (cryptoIsEnable === undefined) {
    return (
      <Box
        sx={{
          flexGrow: 1,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={52} />
      </Box>
    );
  }

  if (cryptoIsEnable && !isAuthed) {
    return <UnlockCrypto></UnlockCrypto>;
  }

  return children;
}
