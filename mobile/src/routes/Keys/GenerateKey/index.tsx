import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { invoke } from '@tauri-apps/api/core';
import { Box, Button } from '@mui/material';
import { addKey } from 'tauri-plugin-data';
import { useKeys } from 'shared';

import GenerateKeyForm, {
  GenerateKeyFormFields,
} from '@/components/GenerateKeyForm';
import PageDrawer from '@/components/PageDrawer';
import Loading from '@/components/Loading';

type GenerateKeyProps = {
  open?: boolean;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function GenerateKey({
  open,
  onOk,
  onCancel,
}: GenerateKeyProps) {
  const { refresh: refreshKeys } = useKeys();
  const formApi = useForm<GenerateKeyFormFields>({
    defaultValues: {
      name: '',
      algorithm: '',
      bitSize: '',
      curve: '',
      passphrase: '',
    },
  });

  const [loading, setLoading] = useState(false);

  const onGenerate = useCallback(
    async (values: GenerateKeyFormFields) => {
      setLoading(true);
      try {
        const { privateKey, publicKey } = await invoke<{
          privateKey: string;
          publicKey: string;
        }>('generate_key', {
          algorithm: {
            type: values.algorithm,
            bitSize: values.bitSize,
            curve: values.curve,
          },
          passphrase: values.passphrase,
        });

        await addKey({
          name: values.name,
          privateKey,
          publicKey,
          passphrase: values.passphrase,
        });
      } finally {
        setLoading(false);
      }

      await refreshKeys();
      onOk();
    },
    [onOk, refreshKeys]
  );

  useEffect(() => {
    if (open) {
      return;
    }

    formApi.reset();
  }, [formApi, open]);

  return (
    <PageDrawer
      loading={loading}
      open={open}
      title="Generate key"
      onCancel={onCancel}
      footer={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Loading
            loading={loading}
            sx={{
              width: '48%',
            }}
          >
            <Button fullWidth variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
          </Loading>

          <Loading
            loading={loading}
            sx={{
              width: '48%',
            }}
          >
            <Button
              fullWidth
              variant="contained"
              onClick={formApi.handleSubmit(onGenerate)}
            >
              Generate
            </Button>
          </Loading>
        </Box>
      }
    >
      <GenerateKeyForm formApi={formApi} />
    </PageDrawer>
  );
}
