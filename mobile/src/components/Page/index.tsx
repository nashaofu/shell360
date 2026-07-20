import type { ReactNode } from "react";

import { ArrowLeftIcon, MenuIcon } from "shared";
import { useGlobalStateAtomWithApi } from "@/atoms/globalState.atom";
import useMediaQuery from "@/hooks/useMediaQuery";
import styles from "./index.module.less";

type PageProps = {
  title: ReactNode;
  headerRight?: ReactNode;
  navigation?: "menu" | "back";
  onNavigation?: () => void;
  subtitle?: ReactNode;
  children: ReactNode;
};

export default function Page({
  title,
  headerRight,
  navigation = "menu",
  onNavigation,
  subtitle,
  children,
}: PageProps) {
  const { openSidebar, toggleSidebar } = useGlobalStateAtomWithApi();
  const isTablet = useMediaQuery("(min-width: 840px)");

  const handleNavigation = () => {
    if (navigation === "back") {
      onNavigation?.();
    } else if (isTablet) {
      toggleSidebar();
    } else {
      openSidebar();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.safeTop} />
      <header className={styles.header}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={handleNavigation}
          aria-label={navigation === "back" ? "Go back" : "Open menu"}
        >
          {navigation === "back" ? <ArrowLeftIcon /> : <MenuIcon />}
        </button>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
        {headerRight && <div className={styles.actions}>{headerRight}</div>}
      </header>
      <section className={styles.content}>{children}</section>
    </div>
  );
}
