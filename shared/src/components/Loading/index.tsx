import { ReactNode } from 'react';
import { Box, CircularProgress, SxProps, Theme, alpha } from '@mui/material';

export type LoadingProps = {
  sx?: SxProps<Theme>;
  loading?: boolean;
  size?: string | number;
  progress?: number;
  children?: ReactNode;
};

export function Loading({
  sx,
  loading,
  size = 18,
  children,
  progress,
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
            backgroundColor: (theme) =>
              alpha(theme.palette.background.paper, 0.5),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <CircularProgress size={size} />
          {progress !== undefined && (
            <Box sx={{ mt: 3, fontWeight: 'bold' }}>{progress}%</Box>
          )}
        </Box>
      )}
    </Box>
  );
}
