import { get } from "lodash-es";
import { type ErrorProps, StatusButton } from "../common";
import ErrorText from "../ErrorText";
import styles from "../styles.module.less";

export default function DefaultError({ error, onClose, onRetry }: ErrorProps) {
  return (
    <>
      <ErrorText
        title="Connection failed"
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
