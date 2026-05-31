import clsx from "clsx";
import type { ReactNode } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import {
  FingerprintIcon,
  HostIcon,
  KeyIcon,
  SettingsIcon,
  SiteMapIcon,
} from "shared";
import { useSetTerminalViewVisible } from "@/atoms/terminalView.atom";
import styles from "./index.module.less";

type NavItem = {
  icon: ReactNode;
  pageTitle: string;
  to: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    icon: <HostIcon className={styles.navIcon} />,
    pageTitle: "Hosts",
    to: "/",
  },
  {
    icon: <SiteMapIcon className={styles.navIcon} />,
    pageTitle: "Port Forwardings",
    to: "/port-forwardings",
  },
  {
    icon: <KeyIcon className={styles.navIcon} />,
    pageTitle: "Keys",
    to: "/keys",
  },
  {
    icon: <FingerprintIcon className={styles.navIcon} />,
    pageTitle: "Known Hosts",
    to: "/known-hosts",
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    icon: <SettingsIcon className={styles.navIcon} />,
    pageTitle: "Settings",
    to: "/settings",
  },
];

type NavSectionProps = {
  items: NavItem[];
  className?: string;
  itemClassName?: string;
  pathname: string;
  onNavigate: (to: string) => void;
};

function NavSection({
  items,
  className,
  itemClassName,
  pathname,
  onNavigate,
}: NavSectionProps) {
  return (
    <div className={className}>
      {items.map((item) => {
        const active = !!matchPath({ path: item.to, end: true }, pathname);

        return (
          <button
            key={item.to}
            type="button"
            className={clsx(
              styles.navItem,
              itemClassName,
              active && styles.active,
            )}
            title={item.pageTitle}
            aria-label={item.pageTitle}
            onClick={() => onNavigate(item.to)}
          >
            {item.icon}
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
        itemClassName={styles.navBottomItem}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </aside>
  );
}
