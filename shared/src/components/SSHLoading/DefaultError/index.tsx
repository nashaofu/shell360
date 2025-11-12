import { Box } from '@mui/material';

import ErrorText from '../ErrorText';
import { StatusButton, type ErrorProps } from '../common';

export default function DefaultError({
  error,
  onClose,
  onRetry,
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
        <StatusButton variant="contained" onClick={onRetry}>
          Retry
        </StatusButton>
      </Box>
    </>
  );
}
