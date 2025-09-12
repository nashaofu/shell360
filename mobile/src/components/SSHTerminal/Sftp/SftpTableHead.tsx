import { TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';

import { SftpTableCell, SftpTableOrder } from './types';

export type SftpTableHeadProps<T extends Record<string, unknown>> = {
  cells: SftpTableCell<T>[];
  orderBy?: keyof T;
  order?: SftpTableOrder;
  onSort: (orderBy: keyof T, order: SftpTableOrder) => unknown;
};

export function SftpTableHead<T extends Record<string, unknown>>({
  cells,
  orderBy,
  order,
  onSort,
}: SftpTableHeadProps<T>) {
  return (
    <>
      <colgroup>
        {cells.map((item) => {
          return (
            <col
              key={item.id}
              style={{
                width: item.width,
                minWidth: item.minWidth,
                maxWidth: item.maxWidth,
              }}
            />
          );
        })}
      </colgroup>
      <TableHead>
        <TableRow>
          {cells.map((item) => {
            const isSortable = typeof item.compare === 'function';
            const isActive = orderBy === item.id;
            const isAsc = isActive && order === SftpTableOrder.Asc;
            const sx = item.sx?.(true);

            return (
              <TableCell
                key={item.id}
                align={item.align}
                sx={[
                  {
                    width: item.width,
                    minWidth: item.minWidth,
                    maxWidth: item.maxWidth,
                  },
                  ...(Array.isArray(sx) ? sx : [sx]),
                ]}
              >
                {isSortable ? (
                  <TableSortLabel
                    active={isActive}
                    direction={order}
                    onClick={() =>
                      onSort(
                        item.key,
                        isAsc ? SftpTableOrder.Desc : SftpTableOrder.Asc
                      )
                    }
                  >
                    {item.title}
                  </TableSortLabel>
                ) : (
                  item.title
                )}
              </TableCell>
            );
          })}
        </TableRow>
      </TableHead>
    </>
  );
}
