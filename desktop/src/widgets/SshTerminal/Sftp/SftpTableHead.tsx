import styles from "./SftpTableHead.module.less";

import { type SftpTableCell, SftpTableOrder } from "./types";

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
      <thead>
        <tr>
          {cells.map((item) => {
            const isSortable = typeof item.compare === "function";
            const isActive = orderBy === item.id;
            const isAsc = isActive && order === SftpTableOrder.Asc;
            const sx = item.sx?.(true);

            return (
              <th
                key={item.id}
                className={styles.headerCell}
                style={{
                  width: item.width,
                  minWidth: item.minWidth,
                  maxWidth: item.maxWidth,
                  textAlign: (item.align || "left") as
                    | "left"
                    | "center"
                    | "right"
                    | "justify"
                    | "inherit",
                  ...(sx || {}),
                }}
              >
                {isSortable ? (
                  <button
                    type="button"
                    className={
                      isActive
                        ? `${styles.sortButton} ${styles.sortButtonActive}`
                        : styles.sortButton
                    }
                    onClick={() =>
                      onSort(
                        item.key,
                        isAsc ? SftpTableOrder.Desc : SftpTableOrder.Asc,
                      )
                    }
                  >
                    {item.title}
                    <span className={styles.sortIcon}>{isAsc ? "^" : "v"}</span>
                  </button>
                ) : (
                  item.title
                )}
              </th>
            );
          })}
        </tr>
      </thead>
    </>
  );
}
