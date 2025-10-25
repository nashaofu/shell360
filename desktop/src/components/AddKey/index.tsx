import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Box, Button } from '@mui/material';
import { addKey, type Key, updateKey } from 'tauri-plugin-data';
import { EditKeyForm, useKeys, type EditKeyFormFields } from 'shared';

import PageDrawer from '../PageDrawer';

type AddKeyProps = {
  open?: boolean;
  data?: Key;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddKey({ open, data, onOk, onCancel }: AddKeyProps) {
  const { refresh: refreshKeys } = useKeys();
  const formApi = useForm<EditKeyFormFields>({
    defaultValues: {
      name: '',
      publicKey: '',
      privateKey: '',
      passphrase: '',
      certificate: '',
    },
    values: {
      name: data?.name ?? '',
      publicKey: data?.publicKey ?? '',
      privateKey: data?.privateKey ?? '',
      passphrase: data?.passphrase ?? '',
      certificate: data?.certificate ?? '',
    },
  });

  const onSave = useCallback(
    async (values: EditKeyFormFields) => {
      const key = {
        name: values.name || '',
        publicKey: values.publicKey || '',
        privateKey: values.privateKey || '',
        passphrase: values.passphrase,
        certificate: values.certificate,
      };
      if (data) {
        await updateKey({
          ...key,
          id: data.id,
        });
      } else {
        await addKey(key);
      }

      await refreshKeys();

      onOk();
    },
    [data, refreshKeys, onOk]
  );

  useEffect(() => {
    if (open) {
      return;
    }

    formApi.reset();
  }, [formApi, open]);

  return (
    <PageDrawer
      open={open}
      title={data ? 'Edit key' : 'Add key'}
      onCancel={onCancel}
      footer={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button
            sx={{
              width: '48%',
            }}
            variant="outlined"
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            sx={{
              width: '48%',
            }}
            variant="contained"
            onClick={formApi.handleSubmit(onSave)}
          >
            Save
          </Button>
        </Box>
      }
    >
      <EditKeyForm formApi={formApi} />
    </PageDrawer>
  );
}
