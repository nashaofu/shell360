import { type ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

import useAutoRepeatGridTemplateColumns from './useAutoRepeatGridTemplateColumns';

type AutoRepeatGridProps = {
  itemWidth: number;
  sx: SxProps<Theme>;
  children: ReactNode;
};

export default function AutoRepeatGrid({
  itemWidth,
  sx,
  children,
}: AutoRepeatGridProps) {
  const { gridElRef, gridTemplateColumns } =
    useAutoRepeatGridTemplateColumns(itemWidth);

  return (
    <Box
      ref={gridElRef}
      sx={[
        {
          display: 'grid',
          gridTemplateColumns,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
