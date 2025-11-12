import { Box } from '@mui/material';
import { get } from 'lodash-es';

export type ErrorTextProps = {
  error?: unknown;
};

export default function ErrorText({ error }: ErrorTextProps) {
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
