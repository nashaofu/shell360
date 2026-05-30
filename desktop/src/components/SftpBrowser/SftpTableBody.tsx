import SftpFilenameInput from "./SftpFilenameInput";
import type { SftpTableCell } from "./types";
import type { CreateType } from "./useCreate";
import styles from "./SftpTableBody.module.less";

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
    <tbody>
        {!isRoot && (
          <tr onDoubleClick={onParentClick} className={styles.tableRow}>
          {cells.map((item, index) => {
            const sx = item.sx?.(false);
            return (
              <td
                key={String(item.key)}
                className={styles.bodyCell}
                style={{
                  textAlign: (item.align || "left") as
                    | "left"
                    | "center"
                    | "right"
                    | "justify"
                    | "inherit",
                  ...(sx || {}),
                }}
              >
                {index === 0 && <div className={styles.parentLink}><span className="icon-folder-open" /> ..</div>}
              </td>
            );
          })}
        </tr>
      )}
      {createType && (
        <tr onDoubleClick={onParentClick}>
          {cells.map((item, index) => {
            const sx = item.sx?.(false);
            return (
              <td
                key={String(item.key)}
                className={styles.bodyCell}
                style={{
                  textAlign: (item.align || "left") as
                    | "left"
                    | "center"
                    | "right"
                    | "justify"
                    | "inherit",
                  ...(sx || {}),
                }}
              >
                {index === 0 && (
                  <div className={styles.createInputWrap}>
                    <SftpFilenameInput
                      value={creatingFilename}
                      onChange={onCreatingFilenameChange}
                      onCancel={onCreateCancel}
                      onOk={onCreateOk}
                    ></SftpFilenameInput>
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      )}
      {data.map((row, index) => (
        <tr key={String(row[dataKey] ?? index)} className={styles.tableRow}>
          {cells.map((item) => {
            const sx = item.sx?.(false);

            return (
              <td
                key={String(item.key)}
                className={styles.bodyCell}
                style={{
                  width: item.width,
                  minWidth: item.minWidth,
                  maxWidth: item.maxWidth,
                  overflow: "hidden",
                  textAlign: (item.align || "left") as
                    | "left"
                    | "center"
                    | "right"
                    | "justify"
                    | "inherit",
                  ...(sx || {}),
                }}
              >
                {item.render(row, index)}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
