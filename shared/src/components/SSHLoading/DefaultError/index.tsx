import { get } from "lodash-es";

import styles from "../styles.module.scss";
import { type ErrorProps, StatusButton } from "../common";
import ErrorText from "../ErrorText";

export default function DefaultError({ error, onClose, onRetry }: ErrorProps) {
  return (
    <>
      <ErrorText
        title={get(error, "type", "Unknown error")}
        message={get(error, "message", String(error))}
      />
      <div className={styles.actions}>
        <StatusButton variant="outlined" onClick={onClose}>
          Close
        </StatusButton>
        <StatusButton variant="contained" onClick={onRetry}>
          Retry
        </StatusButton>
      </div>
    </>
  );
}
