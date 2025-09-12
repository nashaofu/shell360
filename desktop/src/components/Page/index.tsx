import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

type PageProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function Page({ title, children }: PageProps) {
  return (
    <Box
      sx={{
        flexGrow: 1,
        px: 2,
        pt: 0,
        pb: 1,
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      <Typography variant="h5" fontWeight={500}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
