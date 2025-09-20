import { Box, Typography, Button, Grid } from '@mui/material';
import { useRequest } from 'ahooks';
import { KeyboardEvent, useCallback, useState } from 'react';
import { loadCryptoByPassword, resetCrypto } from 'tauri-plugin-data';

import TextFieldPassword from '@/components/TextFieldPassword';
import useMessage from '@/hooks/useMessage';
import Loading from '@/components/Loading';
import useModal from '@/hooks/useModal';

export default function UnlockVault() {
  const [password, setPassword] = useState('');
  const message = useMessage();
  const modal = useModal();

  const { run: onUnlock, loading: loadCryptoLoading } = useRequest(
    () => loadCryptoByPassword({ password }),
    {
      manual: true,
      onError: () => {
        message.error({
          message: 'Unlock failed, please confirm the password is correct',
        });
      },
    }
  );

  const onEnter = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.code === 'Enter') {
      onUnlock();
    }
  }, [onUnlock]);

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
        flexGrow: 1,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: 340,
        }}
      >
        <Loading loading={loading} size={48}>
          <Typography variant="h6" align="center">
            Enter your password to unlock application data
          </Typography>
          <Box sx={{ mt: 6 }}>
            <TextFieldPassword
              fullWidth
              placeholder="Please enter the password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={onEnter}
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
