import { Card, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import styles from "./index.module.less";

type ItemCardProps = {
  icon: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  extra?: ReactNode;
  variant?: "outlined" | "elevation";
  elevation?: number;
  onDoubleClick?: () => unknown;
};

export default function ItemCard({
  icon,
  title,
  desc,
  extra,
  variant = "outlined",
  elevation,
  onDoubleClick,
}: ItemCardProps) {
  const cardClassName = [
    styles.card,
    variant === "elevation" ? styles.cardElevation : "",
  ].join(" ");

  return (
    <Card
      className={cardClassName}
      variant={variant === "outlined" ? "surface" : "classic"}
      style={
        variant === "elevation" && elevation
          ? {
              boxShadow: `var(--shadow-${Math.min(Math.max(elevation, 1), 6)})`,
            }
          : undefined
      }
      onDoubleClick={onDoubleClick}
    >
      <Flex align="center" justify="between" gap="3">
        <Flex align="center" gap="3" className={styles.contentWrap}>
          <Flex className={styles.iconWrap} align="center" justify="center">
            {icon}
          </Flex>
          <div className={styles.content}>
            <Text as="div" weight="medium" className={styles.title}>
              {title}
            </Text>
            {desc && (
              <Text as="div" size="2" color="gray" className={styles.desc}>
                {desc}
              </Text>
            )}
          </div>
        </Flex>
        {extra && <div className={styles.extra}>{extra}</div>}
      </Flex>
    </Card>
  );
}
