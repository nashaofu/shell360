import {
  Box,
  Icon,
  LinearProgress,
  type SxProps,
  type Theme,
} from '@mui/material';
import { get } from 'lodash-es';

import { getHostName } from '@/utils/host';

import { Loading } from '../Loading';

import DefaultError from './DefaultError';
import UnknownKey from './UnknownKey';
import AuthenticationError from './AuthenticationError';
import type { ErrorProps } from './common';

const STATUS_BUTTONS = {
  ConnectFailed: DefaultError,
  UnknownKey: UnknownKey,
  AuthenticationError: AuthenticationError,
  default: DefaultError,
};

type SSHLoadingProps = {
  sx?: SxProps<Theme>;
} & ErrorProps;

export function SSHLoading({
  host,
  loading,
  error,
  sx,
  onReConnect,
  onReAuth,
  onRetry,
  onClose,
  onOpenAddKey,
}: SSHLoadingProps) {
  const errorType = get(error as never, 'type') as keyof typeof STATUS_BUTTONS;

  const render = STATUS_BUTTONS[errorType] || STATUS_BUTTONS.default;
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
          <LinearProgress color={error ? 'error' : 'primary'} />
        </Box>
        {!!error && (
          <Box
            sx={{
              px: 1.5,
              py: 1,
              mx: 'auto',
              my: 2,
            }}
          >
            <Loading loading={loading}>
              {render({
                host,
                loading,
                error,
                onReConnect,
                onReAuth,
                onRetry,
                onClose,
                onOpenAddKey,
              })}
            </Loading>
          </Box>
        )}
      </Box>
    </Box>
  );
}
