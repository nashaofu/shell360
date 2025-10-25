import { Box } from '@mui/material';

import BasicForm from './BasicForm';
import JumpHostsForm from './JumpHostsForm';
import TerminalSettingsForm from './TerminalSettingsForm';
import type { EditHostFormFields, EditHostFormApi } from './types';

export type EditHostFormProps = {
  formApi: EditHostFormApi;
  onOpenAddKey: () => void;
};

export type { EditHostFormApi, EditHostFormFields };

export function EditHostForm({ formApi, onOpenAddKey }: EditHostFormProps) {
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
      <BasicForm formApi={formApi} sx={{ mb: 3 }} onOpenAddKey={onOpenAddKey} />
      <JumpHostsForm formApi={formApi} sx={{ mb: 3 }} />
      <TerminalSettingsForm formApi={formApi} sx={{ mb: 3 }} />
    </Box>
  );
}
