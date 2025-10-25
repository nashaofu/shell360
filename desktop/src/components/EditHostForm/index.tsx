import { UseFormReturn } from 'react-hook-form';
import { Box } from '@mui/material';
import { Host } from 'tauri-plugin-data';

import BasicForm from './BasicForm';
import JumpHostsForm from './JumpHostsForm';
import TerminalSettingsForm from './TerminalSettingsForm';

type EditHostFormProps = {
  formApi: UseFormReturn<Omit<Host, 'id'>>;
  hostId?: string;
};

export default function EditHostForm({
  formApi,
  hostId: currentHostId,
}: EditHostFormProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
      }}
      component="form"
      noValidate
      autoComplete="off"
    >
      <BasicForm formApi={formApi} sx={{ mb: 3 }}></BasicForm>
      <JumpHostsForm
        formApi={formApi}
        hostId={currentHostId}
        sx={{ mb: 3 }}
      ></JumpHostsForm>
      <TerminalSettingsForm
        formApi={formApi}
        sx={{ mb: 3 }}
      ></TerminalSettingsForm>
    </Box>
  );
}
