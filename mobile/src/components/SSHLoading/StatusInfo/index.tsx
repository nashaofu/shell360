import { Box, Button, ButtonGroup, Icon, styled } from '@mui/material';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { get } from 'lodash-es';
import { Dropdown } from 'shared';

export type ErrorTextProps = {
  error?: unknown;
};

function ErrorText({ error }: ErrorTextProps) {
  return (
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
  );
}

export type StatusInfoProps = {
  error?: unknown;
  onReConnect: (checkServerKey: SSHSessionCheckServerKey) => unknown;
  onReAuth: () => unknown;
  onRetry: () => unknown;
  onClose?: () => unknown;
};

const StatusButton = styled(Button, {
  name: 'StatusButton',
})(() => ({
  minWidth: 150,
}));

const STATUS_BUTTONS = {
  ConnectFailed: ({ error, onReConnect, onClose }: StatusInfoProps) => {
    return (
      <>
        <ErrorText error={error} />
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
          <StatusButton variant="contained" onClick={onReConnect}>
            Retry
          </StatusButton>
        </Box>
      </>
    );
  },
  UnknownKey: ({ error, onReConnect, onClose }: StatusInfoProps) => {
    return (
      <>
        <ErrorText error={error} />
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
                onClick: () =>
                  onReConnect(SSHSessionCheckServerKey.AddAndContinue),
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
                  onClick={() => onReConnect(SSHSessionCheckServerKey.Continue)}
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
  AuthFailed: ({ error, onReAuth, onClose }: StatusInfoProps) => {
    return (
      <>
        <ErrorText error={error} />
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
          <StatusButton variant="contained" onClick={onReAuth}>
            Retry
          </StatusButton>
        </Box>
      </>
    );
  },
  default: ({ error, onRetry, onClose }: StatusInfoProps) => {
    return (
      <>
        <ErrorText error={error} />
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
    );
  },
};

export default function StatusInfo(props: StatusInfoProps) {
  const errorType = get(props.error, 'type');
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
