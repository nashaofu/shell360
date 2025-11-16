import {
  Box,
  Button,
  LinearProgress,
  styled,
  type ButtonProps,
} from '@mui/material';
import { get } from 'lodash-es';
import { useMemo, type ComponentType } from 'react';
import type { PortForwarding } from 'tauri-plugin-data';

import { useHosts } from '@/hooks/useHosts';
import { getPortForwardingDesc } from '@/utils/portForwarding';

export const StatusButton: ComponentType<ButtonProps> = styled(Button, {
  name: 'StatusButton',
})(() => ({
  minWidth: 150,
}));

export type PortForwardingLoadingProps = {
  portForwarding: PortForwarding;
  error: unknown;
  onClose: () => void;
  onRetry: () => void;
};

export function PortForwardingLoading({
  portForwarding,
  error,
  onClose,
  onRetry,
}: PortForwardingLoadingProps) {
  const { data: hosts } = useHosts();
  const hostsMap = useMemo(
    () => new Map(hosts?.map((host) => [host.id, host])),
    [hosts]
  );

  return (
    <Box
      sx={{
        p: 3,
        maxWidth: '100%',
        mx: 'auto',
      }}
    >
      <Box>
        <Box
          sx={{
            fontSize: 16,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            py: 1.5,
          }}
        >
          Opening {portForwarding.name} ...
        </Box>
        <Box
          sx={{
            fontSize: 12,
            wordBreak: 'break-all',
            userSelect: 'text',
          }}
        >
          {getPortForwardingDesc(portForwarding, hostsMap)}
        </Box>
      </Box>
      <Box
        sx={{
          py: 1.5,
        }}
      >
        <LinearProgress color={error ? 'error' : 'primary'} />
      </Box>
      {!!error && (
        <>
          <Box
            sx={{
              fontSize: '14px',
              mx: 'auto',
              mt: 3,
              mb: 5,
              wordBreak: 'break-all',
              userSelect: 'text',
            }}
          >
            {get(error, 'message', String(error))}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <StatusButton variant="outlined" onClick={onClose}>
              Close
            </StatusButton>
            <StatusButton variant="contained" onClick={onRetry}>
              Retry
            </StatusButton>
          </Box>
        </>
      )}
    </Box>
  );
}
