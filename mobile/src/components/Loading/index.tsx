import { ReactNode } from 'react';
import {
  Box, CircularProgress, SxProps, Theme, alpha,
} from '@mui/material';

type LoadingProps = {
  sx?: SxProps<Theme>;
  loading?: boolean;
  size?: string | number;
  children?: ReactNode;
};

export default function Loading({
  sx,
  loading,
  size = 18,
  children,
}: LoadingProps) {
  return (
    <Box
      sx={[
        {
          position: 'relative',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.5),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <CircularProgress size={size} />
        </Box>
      )}
    </Box>
  );
}
