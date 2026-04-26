import clsx from "clsx";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { useSetTerminalViewVisible } from "@/atoms/terminalView.atom";
import { PAGES, type PageConfig } from "@/config/pages";
import styles from "./index.module.less";

const NAV_ITEMS = PAGES.filter((page) => page.section === "main");
const BOTTOM_ITEMS = PAGES.filter((page) => page.section === "bottom");

type NavSectionProps = {
  items: PageConfig[];
  className?: string;
  pathname: string;
  onNavigate: (to: string) => void;
};

function NavSection({
  items,
  className,
  pathname,
  onNavigate,
}: NavSectionProps) {
  return (
    <div className={className}>
      {items.map((item) => {
        const active = !!matchPath({ path: item.path, end: true }, pathname);

        return (
          <button
            key={item.path}
            type="button"
            className={clsx(styles.navItem, active && styles.active)}
            title={item.label}
            aria-label={item.label}
            onClick={() => onNavigate(item.path)}
          >
            <item.Icon className={styles.navIcon} />
          </button>
        );
      })}
    </div>
  );
}

export default function NavRail() {
  const navigate = useNavigate();
  const setTerminalViewVisible = useSetTerminalViewVisible();
  const { pathname } = useLocation();
  const onNavigate = (to: string) => {
    setTerminalViewVisible(false);
    navigate(to, { replace: true });
  };

  return (
    <aside className={styles.navRail}>
      <NavSection
        items={NAV_ITEMS}
        className={styles.navList}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <div className={styles.navSpacer} />
      <NavSection
        items={BOTTOM_ITEMS}
        className={styles.navBottom}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </aside>
  );
}
