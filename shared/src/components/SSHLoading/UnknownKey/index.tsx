import { Button, DropdownMenu } from "@radix-ui/themes";
import { get } from "lodash-es";
import { SSHSessionCheckServerKey } from "tauri-plugin-ssh";

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
        <div className={styles.splitButtonGroup}>
          <Button
            style={{ flex: 1, minWidth: 0 }}
            onClick={() => onReConnect(SSHSessionCheckServerKey.Continue)}
          >
            Continue
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button
                style={{
                  width: 34,
                  minWidth: 34,
                  padding: 0,
                  justifyContent: "center",
                }}
              >
                <span className="icon-more" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
              <DropdownMenu.Item
                onSelect={() =>
                  onReConnect(SSHSessionCheckServerKey.AddAndContinue)
                }
              >
                Add and continue
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
    </>
  );
}
