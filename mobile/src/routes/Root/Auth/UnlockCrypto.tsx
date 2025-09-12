import { Box, Typography, Button, Grid } from '@mui/material';
import { useRequest } from 'ahooks';
import { useState } from 'react';
import { loadCryptoByPassword, resetCrypto } from 'tauri-plugin-data';
import { useSetAtom } from 'jotai';

import TextFieldPassword from '@/components/TextFieldPassword';
import useMessage from '@/hooks/useMessage';
import Loading from '@/components/Loading';
import useModal from '@/hooks/useModal';
import { authAtom } from '@/atom/authAtom';

export default function UnlockVault() {
  const setIsAuth = useSetAtom(authAtom);
  const [password, setPassword] = useState('');
  const message = useMessage();
  const modal = useModal();

  const { run: onUnlock, loading: loadCryptoLoading } = useRequest(
    () => loadCryptoByPassword({ password }),
    {
      manual: true,
      onSuccess: () => {
        setIsAuth(true);
      },
      onError: () => {
        message.error({
          message: 'Unlock failed, please confirm the password is correct',
        });
      },
    }
  );

  const { run: onReset, loading: resetLoading } = useRequest(
    async () => {
      const isContinue = await new Promise((resolve) => {
        modal.confirm({
          title: <Box>Warning</Box>,
          content:
            'All application data will be reset soon, whether to continue',
          onOk: () => {
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      });

      if (!isContinue) {
        return;
      }

      return resetCrypto();
    },
    {
      manual: true,
      onError: () => {
        message.error({
          message: 'Reset application failed',
        });
      },
    }
  );

  const loading = loadCryptoLoading || resetLoading;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        flexGrow: 1,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
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
          width: 340,
        }}
      >
        <Loading loading={loading} size={48}>
          <Typography variant="subtitle1" align="center">
            Enter your password to unlock application data
          </Typography>
          <Box sx={{ mt: 6 }}>
            <TextFieldPassword
              fullWidth
              placeholder="Please enter the password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            ></TextFieldPassword>
          </Box>
          <Grid
            sx={{
              mt: 3,
            }}
            container
            spacing={2}
          >
            <Grid size={6}>
              <Button fullWidth variant="contained" onClick={onUnlock}>
                Unlock
              </Button>
            </Grid>
            <Grid size={6}>
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={onReset}
              >
                Reset APP
              </Button>
            </Grid>
          </Grid>
        </Loading>
      </Box>
    </Box>
  );
}
