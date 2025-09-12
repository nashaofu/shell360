import { getCurrentWindow } from '@tauri-apps/api/window';
import { get } from 'lodash-es';
import {
  Box, Button, Typography, styled,
} from '@mui/material';
import { useCallback } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';

const Eye = styled(Box)(({ theme }) => ({
  width: 70,
  height: 100,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: theme.palette.grey[800],
  borderRadius: '50%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const Eyeball = styled(Box)(({ theme }) => ({
  width: '50%',
  height: '50%',
  borderRadius: '50%',
  backgroundColor: theme.palette.grey[800],
  animation: 'eye-move 1.6s infinite alternate',
  '@keyframes eye-move': {
    '0%': {
      transform: 'translate(50%)',
    },
    '10%': {
      transform: 'translate(50%)',
    },
    '90%': {
      transform: 'translate(-50%)',
    },
    '100%': {
      transform: 'translate(-50%)',
    },
  },
}));

type AbnormalProps = {
  error?: unknown;
  resetErrorBoundary?: () => unknown;
};

export default function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: AbnormalProps) {
  const onReset = useCallback(async () => {
    const answer = await ask(
      'This operation will clear all app configurations, are you sure you want to continue?',
      {
        title: 'Warning',
        kind: 'warning',
      },
    );

    if (answer) {
      window.localStorage.clear();
      window.location.reload();
    }
  }, []);

  return (
    <Box
      sx={{
        p: 3,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 150,
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Eye>
            <Eyeball />
          </Eye>
          <Eye>
            <Eyeball />
          </Eye>
        </Box>
      </Box>
      <Box
        sx={{
          mt: 4,
        }}
      >
        <Typography variant="h3">Oops!</Typography>
      </Box>
      <Box
        sx={{
          maxHeight: 160,
          my: 3,
          whiteSpace: 'wrap',
          wordBreak: 'break-all',
          overflow: 'auto',
        }}
      >
        <Typography variant="body1">
          {get(error, 'message', String(error))}
        </Typography>
      </Box>
      <Box
        sx={{
          maxWidth: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          mx: 'auto',
        }}
      >
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={resetErrorBoundary}
        >
          Retry
        </Button>
        <Button
          variant="contained"
          size="large"
          color="error"
          fullWidth
          onClick={onReset}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          size="large"
          color="warning"
          fullWidth
          onClick={() => getCurrentWindow().close()}
        >
          Exit
        </Button>
      </Box>
    </Box>
  );
}
