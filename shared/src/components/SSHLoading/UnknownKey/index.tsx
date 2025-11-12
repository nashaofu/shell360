import { Box, Button, ButtonGroup, Icon } from '@mui/material';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';

import { Dropdown } from '@/components/Dropdown';

import ErrorText from '../ErrorText';
import { StatusButton, type ErrorProps } from '../common';

export default function UnknownKey({
  error,
  onReConnect,
  onClose,
}: ErrorProps) {
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
}
