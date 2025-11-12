import { Box, Button, ButtonGroup, Icon } from '@mui/material';
import { useForm } from 'react-hook-form';
import { AuthenticationMethod, updateHost } from 'tauri-plugin-data';
import { useCallback } from 'react';

import {
  AuthenticationForm,
  type AuthenticationFormFields,
} from '@/components/AuthenticationForm';
import { Dropdown } from '@/components/Dropdown';
import { useHosts } from '@/hooks/useHosts';

import ErrorText from '../ErrorText';
import { StatusButton, type ErrorProps } from '../common';

export default function AuthenticationError({
  host,
  error,
  onReAuth,
  onClose,
  onOpenAddKey,
}: ErrorProps) {
  const { refresh: refreshHosts } = useHosts();
  const formApi = useForm<AuthenticationFormFields>({
    defaultValues: {
      username: '',
      authenticationMethod: AuthenticationMethod.Password,
      password: '',
      keyId: '',
    },
    values: {
      username: host?.username ?? '',
      authenticationMethod:
        host?.authenticationMethod ?? AuthenticationMethod.Password,
      password: host?.password ?? '',
      keyId: host?.keyId ?? '',
    },
  });

  const onContinue = useCallback(
    async (values: AuthenticationFormFields, isSave: boolean) => {
      const authenticationMethod =
        values.authenticationMethod || AuthenticationMethod.Password;

      const hostData = {
        ...host,
        username: values.username || '',
        authenticationMethod: authenticationMethod,
        password:
          authenticationMethod === AuthenticationMethod.Password
            ? values.password || ''
            : undefined,
        keyId:
          authenticationMethod === AuthenticationMethod.PublicKey ||
          authenticationMethod === AuthenticationMethod.Certificate
            ? values.keyId || ''
            : undefined,
      };
      if (isSave) {
        await updateHost(hostData);
        await refreshHosts();
      }
      onReAuth(hostData);
    },
    [host, onReAuth, refreshHosts]
  );

  return (
    <Box component="form" noValidate autoComplete="off">
      <ErrorText error={error} />
      <AuthenticationForm formApi={formApi} onOpenAddKey={onOpenAddKey} />
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
              label: 'Save and continue',
              value: 'Save and continue',
              onClick: formApi.handleSubmit((values) =>
                onContinue(values, true)
              ),
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
              color="primary"
            >
              <Button
                fullWidth
                onClick={formApi.handleSubmit((values) =>
                  onContinue(values, false)
                )}
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
    </Box>
  );
}
