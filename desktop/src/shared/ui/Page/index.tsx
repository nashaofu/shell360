import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./index.module.less";

type PageProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export default function Page({
  eyebrow,
  title,
  description,
  actions,
  children,
}: PageProps) {
  return (
    <section className={styles.page}>
      <Card variant="surface">
        <Flex className={styles.header} align="start" justify="between" gap="4">
          <Flex className={styles.headerMain} direction="column" gap="2">
            {eyebrow && (
              <Text size="1" color="gray" className={styles.eyebrow}>
                {eyebrow}
              </Text>
            )}
            <Heading size="7">{title}</Heading>
            {description && (
              <Text size="2" color="gray">
                {description}
              </Text>
            )}
          </Flex>
          {actions && <Flex className={styles.actions}>{actions}</Flex>}
        </Flex>
      </Card>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
