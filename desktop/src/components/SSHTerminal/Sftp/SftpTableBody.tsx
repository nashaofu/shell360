import { Box, TableBody, TableCell, TableRow } from '@mui/material';

import { SftpTableCell } from './types';
import SftpFilenameInput from './SftpFilenameInput';
import { CreateType } from './useCreate';

export type SftpTableBodyProps<T extends Record<string, unknown>> = {
  dataKey: keyof T;
  data: T[];
  cells: SftpTableCell<T>[];
  isRoot: boolean;
  createType?: CreateType;
  creatingFilename?: string;
  onCreatingFilenameChange: (val: string) => unknown;
  onCreateCancel: () => unknown;
  onCreateOk: () => unknown;
  onParentClick: () => unknown;
};

export function SftpTableBody<T extends Record<string, unknown>>({
  dataKey,
  data,
  cells,
  isRoot,
  createType,
  creatingFilename,
  onCreatingFilenameChange,
  onCreateCancel,
  onCreateOk,
  onParentClick,
}: SftpTableBodyProps<T>) {
  return (
    <TableBody>
      {!isRoot && (
        <TableRow onDoubleClick={onParentClick}>
          {cells.map((item, index) => {
            const sx = item.sx?.(false);
            return (
              <TableCell key={String(item.key)} align={item.align} sx={sx}>
                {index === 0 && <Box sx={{ cursor: 'pointer' }}>..</Box>}
              </TableCell>
            );
          })}
        </TableRow>
      )}
      {createType && (
        <TableRow onDoubleClick={onParentClick}>
          {cells.map((item, index) => {
            const sx = item.sx?.(false);
            return (
              <TableCell key={String(item.key)} align={item.align} sx={sx}>
                {index === 0 && (
                  <Box
                    sx={{
                      width: 288,
                    }}
                  >
                    <SftpFilenameInput
                      value={creatingFilename}
                      onChange={onCreatingFilenameChange}
                      onCancel={onCreateCancel}
                      onOk={onCreateOk}
                    ></SftpFilenameInput>
                  </Box>
                )}
              </TableCell>
            );
          })}
        </TableRow>
      )}
      {data.map((row, index) => (
        <TableRow key={String(row[dataKey] ?? index)}>
          {cells.map((item) => {
            const sx = item.sx?.(false);

            return (
              <TableCell
                key={String(item.key)}
                align={item.align}
                sx={[
                  {
                    width: item.width,
                    minWidth: item.minWidth,
                    maxWidth: item.maxWidth,
                    overflow: 'hidden',
                  },
                  ...(Array.isArray(sx) ? sx : [sx]),
                ]}
              >
                {item.render(row, index)}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </TableBody>
  );
}
