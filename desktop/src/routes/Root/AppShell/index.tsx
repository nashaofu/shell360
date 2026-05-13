import { Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";
import NavRail from "../NavRail";
import styles from "./index.module.less";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <Flex className={styles.appShell}>
      <NavRail />
      <main className={styles.workspace}>
        <div className={styles.workspaceScroll}>
          <div className={styles.workspaceInner}>{children}</div>
        </div>
      </main>
    </Flex>
  );
}
