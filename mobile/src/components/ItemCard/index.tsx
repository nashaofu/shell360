import { type ReactNode } from 'react';
import { Box, Paper } from '@mui/material';

type ItemCardProps = {
  icon: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  extra?: ReactNode;
  onClick?: () => unknown;
};

export default function ItemCard({
  icon,
  title,
  desc,
  extra,
  onClick,
}: ItemCardProps) {
  return (
    <Paper
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: (theme) => theme.shape.borderRadius,
        p: 1.5,
        cursor: 'pointer',
      }}
      variant="outlined"
      onClick={onClick}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          display: 'flex',
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
          borderRadius: 2,
          color: (theme) => theme.palette.common.white,
          bgcolor: (theme) => theme.palette.primary.dark,
          overflow: 'hidden',
        }}
      >
        {icon}
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          flexShrink: 1,
          overflow: 'hidden',
          userSelect: 'text',
          ml: 1.5,
          mr: 1.5,
        }}
      >
        <Box
          sx={{
            fontSize: 14,
            fontWeight: 600,
            wordBreak: 'break-all',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </Box>
        {desc && (
          <Box
            sx={{
              fontSize: 12,
              color: (theme) => theme.palette.grey[600],
              wordBreak: 'break-all',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {desc}
          </Box>
        )}
      </Box>
      {extra && (
        <Box
          sx={{
            flexShrink: 0,
          }}
        >
          {extra}
        </Box>
      )}
    </Paper>
  );
}
