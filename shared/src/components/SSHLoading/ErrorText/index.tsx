import { Alert, Box } from '@mui/material';
import type { ReactNode } from 'react';

export type ErrorTextProps = {
  title?: ReactNode;
  message?: ReactNode;
};

export default function ErrorText({ title, message }: ErrorTextProps) {
  return (
    <Box sx={{ mb: 5 }}>
      <Box sx={{ fontWeight: 500, fontSize: 14, mb: 1 }}>{title}</Box>
      <Alert severity="error" icon={false}>
        {message}
      </Alert>
    </Box>
  );
}
