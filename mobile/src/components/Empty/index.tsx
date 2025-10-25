import { Box, Icon, Typography } from '@mui/material';
import { type ReactNode } from 'react';

type EmptyProps = {
  desc?: ReactNode;
  children?: ReactNode;
};

export default function Empty({ desc, children }: EmptyProps) {
  return (
    <Box
      sx={{
        p: 3,
        textAlign: 'center',
      }}
    >
      <Icon
        sx={{
          fontSize: (theme) => theme.typography.h1.fontSize,
          color: (theme) => theme.palette.grey[700],
        }}
        className="icon-empty"
      />
      {!!desc && (
        <Box
          sx={{
            my: 2,
          }}
        >
          <Typography variant="body1">{desc}</Typography>
        </Box>
      )}
      {!!children && (
        <Box
          sx={{
            my: 2,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
