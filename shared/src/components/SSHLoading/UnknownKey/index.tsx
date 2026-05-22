import { Button } from "@radix-ui/themes";
import { get } from "lodash-es";
import { SSHSessionCheckServerKey } from "tauri-plugin-ssh";

import { Dropdown } from "@/components/Dropdown";
import { type ErrorProps, StatusButton } from "../common";
import ErrorText from "../ErrorText";
import styles from "../styles.module.less";

export default function UnknownKey({
  error,
  onReConnect,
  onClose,
}: ErrorProps) {
  return (
    <>
      <ErrorText
        title="Are you sure you want to continue?"
        message={get(error, "message", String(error))}
      />

      <div className={styles.actions}>
        <StatusButton variant="outlined" onClick={onClose}>
          Close
        </StatusButton>
        <Dropdown
          menus={[
            {
              label: "Add and continue",
              value: "Add and continue",
              onClick: () =>
                onReConnect(SSHSessionCheckServerKey.AddAndContinue),
            },
          ]}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          {({ onChangeOpen }) => (
            <div className={styles.splitButtonGroup}>
              <Button
                style={{ flex: 1, minWidth: 0 }}
                onClick={() => onReConnect(SSHSessionCheckServerKey.Continue)}
              >
                Continue
              </Button>
              <Button
                style={{
                  width: 34,
                  minWidth: 34,
                  padding: 0,
                  justifyContent: "center",
                }}
                onClick={(event) => onChangeOpen(event.currentTarget)}
              >
                <span className="icon-more" />
              </Button>
            </div>
          )}
        </Dropdown>
      </div>
    </>
  );
}
