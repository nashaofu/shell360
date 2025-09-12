import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Box, Button } from '@mui/material';
import {
  addPortForwarding,
  updatePortForwarding,
  PortForwarding,
  PortForwardingType,
} from 'tauri-plugin-data';
import { usePortForwardings } from 'shared';

import PageDrawer from '@/components/PageDrawer';
import PortForwardingForm, {
  PortForwardingFormFields,
} from '@/components/PortForwardingForm';

type AddPortForwardingProps = {
  open?: boolean;
  data?: PortForwarding;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddPortForwarding({
  open,
  data,
  onOk,
  onCancel,
}: AddPortForwardingProps) {
  const { refresh: refreshPortForwardings } = usePortForwardings();
  const formApi = useForm<PortForwardingFormFields, 'id'>({
    defaultValues: {
      name: '',
      portForwardingType: PortForwardingType.Local,
      hostId: '',
      localAddress: '',
      localPort: '',
      remoteAddress: '',
      remotePort: '',
    },
    values: {
      name: data?.name ?? '',
      portForwardingType: data?.portForwardingType ?? PortForwardingType.Local,
      hostId: data?.hostId ?? '',
      localAddress: data?.localAddress ?? '',
      localPort: data?.localPort ?? '',
      remoteAddress: data?.remoteAddress ?? '',
      remotePort: data?.remotePort ?? '',
    },
  });

  const save = useCallback(
    (values: PortForwardingFormFields) => {
      const portForwardingData: Omit<PortForwarding, 'id'> = {
        name: values.name,
        portForwardingType: values.portForwardingType,
        hostId: values.hostId,
        localAddress: values.localAddress,
        localPort: Number(values.localPort),
        remoteAddress:
          values.remoteAddress !== undefined && values.remoteAddress !== ''
            ? values.remoteAddress
            : undefined,
        remotePort:
          values.remotePort !== undefined && values.remotePort !== ''
            ? Number(values.remotePort)
            : undefined,
      };
      if (data) {
        return updatePortForwarding({
          ...portForwardingData,
          id: data.id,
        });
      }

      return addPortForwarding(portForwardingData);
    },
    [data]
  );

  const onSave = useCallback(
    async (values: PortForwardingFormFields) => {
      await save(values);
      await refreshPortForwardings();
      onOk();
    },
    [onOk, save, refreshPortForwardings]
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
      title={data ? 'Edit host' : 'Add host'}
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
      <PortForwardingForm formApi={formApi}></PortForwardingForm>
    </PageDrawer>
  );
}
