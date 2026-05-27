import { Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./index.module.less";

type EmptyProps = {
  desc?: ReactNode;
  children?: ReactNode;
};

export default function Empty({ desc, children }: EmptyProps) {
  return (
    <Flex className={styles.root} direction="column" align="center" gap="3">
      <span className={`icon-empty ${styles.icon}`} aria-hidden="true" />
      {!!desc && (
        <Text size="2" color="gray" className={styles.desc}>
          {desc}
        </Text>
      )}
      {!!children && <div className={styles.childrenWrap}>{children}</div>}
    </Flex>
  );
}
