import { clsx } from "clsx";
import { useCallback } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import {
  FingerprintIcon,
  HostIcon,
  KeyIcon,
  SettingsIcon,
  SiteMapIcon,
} from "shared";
import {
  useSetTerminalActiveId,
  useSetTerminalViewVisible,
} from "@/atoms/terminalView.atom";
import styles from "./index.module.less";

type MenuItem = {
  icon: typeof HostIcon;
  label: string;
  to: string;
};

type MenuSection = {
  label: string;
  items: readonly MenuItem[];
};

const MANAGE_SECTION: MenuSection = {
  label: "Manage",
  items: [
    { icon: HostIcon, label: "Hosts", to: "/" },
    { icon: SiteMapIcon, label: "Tunnels", to: "/port-forwardings" },
    { icon: KeyIcon, label: "Keys", to: "/keys" },
    { icon: FingerprintIcon, label: "Known Hosts", to: "/known-hosts" },
  ],
};

const SETTINGS_ITEM: MenuItem = {
  icon: SettingsIcon,
  label: "Settings",
  to: "/settings",
};

const SETTINGS_ITEMS = [SETTINGS_ITEM] as const;

type MenusProps = {
  compact?: boolean;
  onNavigate?: () => void;
};

type MenuListProps = {
  items: readonly MenuItem[];
  pathname: string;
  onSelect: (to: string) => void;
};

function MenuList({ items, pathname, onSelect }: MenuListProps) {
  return (
    <ul className={styles.list}>
      {items.map(({ icon: Icon, label, to }) => {
        const isActive = Boolean(matchPath({ path: to, end: true }, pathname));

        return (
          <li key={to} className={styles.item}>
            <button
              type="button"
              className={clsx(styles.itemBtn, { [styles.active]: isActive })}
              onClick={() => onSelect(to)}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <Icon className={styles.itemIcon} aria-hidden="true" />
              <span className={styles.itemText}>{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function Menus({ compact, onNavigate }: MenusProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setActiveTerminalId = useSetTerminalActiveId();
  const setTerminalViewVisible = useSetTerminalViewVisible();

  const navigateTo = useCallback(
    (to: string) => {
      setActiveTerminalId(null);
      setTerminalViewVisible(false);
      navigate(to);
      onNavigate?.();
    },
    [navigate, onNavigate, setActiveTerminalId, setTerminalViewVisible],
  );

  return (
    <nav
      className={clsx(styles.nav, { [styles.compact]: compact })}
      aria-label="Main navigation"
    >
      <div className={styles.manage}>
        <p className={styles.groupLabel}>{MANAGE_SECTION.label}</p>
        <MenuList
          items={MANAGE_SECTION.items}
          pathname={pathname}
          onSelect={navigateTo}
        />
      </div>

      <div className={styles.settings}>
        <MenuList
          items={SETTINGS_ITEMS}
          pathname={pathname}
          onSelect={navigateTo}
        />
      </div>
    </nav>
  );
}
