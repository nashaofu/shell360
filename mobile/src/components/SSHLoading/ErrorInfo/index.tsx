import { Box, Button, ButtonGroup, Icon, styled } from '@mui/material';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { get } from 'lodash-es';

import Dropdown from '@/components/Dropdown';

type SSHError = {
  type: string;
  message: string;
  [key: string]: unknown;
};

type StatusInfoProps = {
  error?: Error;
  onRefresh: () => unknown;
  onRun: (checkServerKey: SSHSessionCheckServerKey) => unknown;
  onClose?: () => unknown;
};

const StatusButton = styled(Button, {
  name: 'StatusButton',
})(() => ({
  minWidth: 150,
}));

const STATUS_BUTTONS = {
  ConnectFailed: ({ error, onRefresh, onClose }: StatusInfoProps) => {
    return (
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
          {error?.message}
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
          <StatusButton variant="contained" onClick={onRefresh}>
            Retry
          </StatusButton>
        </Box>
      </>
    );
  },
  UnknownKey: ({ error, onRun, onClose }: StatusInfoProps) => {
    return (
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
          {error?.message}
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
          <Dropdown
            menus={[
              {
                label: 'Add and continue',
                value: 'Add and continue',
                onClick: () => onRun(SSHSessionCheckServerKey.AddAndContinue),
              },
            ]}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            {({ onChangeOpen }) => (
              <ButtonGroup
                sx={{
                  minWidth: 150,
                }}
                variant="contained"
                color="warning"
              >
                <Button
                  fullWidth
                  onClick={() => onRun(SSHSessionCheckServerKey.Continue)}
                >
                  Continue
                </Button>
                <Button
                  size="small"
                  onClick={(event) => onChangeOpen(event.currentTarget)}
                >
                  <Icon className="icon-more" />
                </Button>
              </ButtonGroup>
            )}
          </Dropdown>
        </Box>
      </>
    );
  },
  AuthFailed: ({ error, onRefresh, onClose }: StatusInfoProps) => {
    return (
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
          {error?.message}
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
          <StatusButton variant="contained" onClick={onRefresh}>
            Retry
          </StatusButton>
        </Box>
      </>
    );
  },
  default: ({ error, onRefresh, onClose }: StatusInfoProps) => {
    return (
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
          {error?.message}
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
          <StatusButton variant="contained" onClick={onRefresh}>
            Retry
          </StatusButton>
        </Box>
      </>
    );
  },
};

export default function StatusInfo(props: StatusInfoProps) {
  const errorType = get(props.error as Error | SSHError, 'type');
  const render =
    STATUS_BUTTONS[errorType as keyof typeof STATUS_BUTTONS] ||
    STATUS_BUTTONS.default;

  return (
    <Box
      sx={{
        mx: 'auto',
        my: 2,
      }}
    >
      {render(props)}
    </Box>
  );
}
