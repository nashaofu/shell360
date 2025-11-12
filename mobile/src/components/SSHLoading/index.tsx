import {
  Box,
  Icon,
  LinearProgress,
  type SxProps,
  type Theme,
} from '@mui/material';
import { getHostName } from 'shared';
import type { Host } from 'tauri-plugin-data';

import StatusInfo, { type StatusInfoProps } from './StatusInfo';

type SSHLoadingProps = {
  host: Host;
  loading?: boolean;
  sx?: SxProps<Theme>;
} & StatusInfoProps;

export default function SSHLoading({
  host,
  loading,
  error,
  sx,
  onReConnect,
  onReAuth,
  onRetry,
  onClose,
}: SSHLoadingProps) {
  return (
    <Box
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          justifySelf: 'center',
          padding: 2,
          backgroundColor: (theme) => theme.palette.background.paper,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          width: 480,
          maxWidth: '100%',
          minHeight: 260,
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 1.5,
          }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              display: 'flex',
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              borderRadius: 2,
              color: (theme) => theme.palette.common.white,
              bgcolor: (theme) => theme.palette.primary.dark,
            }}
          >
            <Icon className="icon-host" />
          </Box>
          <Box
            sx={{
              flexGrow: 1,
              pl: 1.5,
              overflow: 'hidden',
              userSelect: 'text',
            }}
          >
            <Box
              sx={{
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {getHostName(host)}
            </Box>
            <Box
              sx={{
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {`ssh ${host.username}@${host.hostname} --port ${host.port}`}
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            p: 1.5,
          }}
        >
          <LinearProgress color={!loading && error ? 'error' : 'primary'} />
        </Box>
        {!loading && error && (
          <Box
            sx={{
              px: 1.5,
              py: 1,
            }}
          >
            <StatusInfo
              error={error}
              onReConnect={onReConnect}
              onReAuth={onReAuth}
              onRetry={onRetry}
              onClose={onClose}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
