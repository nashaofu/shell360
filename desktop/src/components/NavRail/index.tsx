import clsx from "clsx";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import styles from "./index.module.less";

type NavItem = {
  icon: string;
  pageTitle: string;
  to: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: "icon-host", pageTitle: "Hosts", to: "/" },
  {
    icon: "icon-site-map",
    pageTitle: "Port Forwardings",
    to: "/port-forwardings",
  },
  { icon: "icon-key", pageTitle: "Keys", to: "/keys" },
  {
    icon: "icon-fingerprint",
    pageTitle: "Known Hosts",
    to: "/known-hosts",
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    icon: "icon-settings",
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
            <span className={clsx(styles.navIcon, item.icon)} />
          </button>
        );
      })}
    </div>
  );
}

export default function NavRail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onNavigate = (to: string) => navigate(to, { replace: true });

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
