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

const MENU_SECTIONS = [
  {
    id: "main",
    items: [
      { icon: HostIcon, text: "Hosts", to: "/" },
      {
        icon: SiteMapIcon,
        text: "Tunnels",
        to: "/port-forwardings",
      },
      { icon: KeyIcon, text: "Keys", to: "/keys" },
      {
        icon: FingerprintIcon,
        text: "Known Hosts",
        to: "/known-hosts",
      },
    ],
  },
  {
    id: "system",
    items: [{ icon: SettingsIcon, text: "Settings", to: "/settings" }],
  },
];

type MenusProps = {
  onClick?: () => unknown;
};

export default function Menus({ onClick }: MenusProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setActiveTerminalId = useSetTerminalActiveId();
  const setTerminalViewVisible = useSetTerminalViewVisible();

  const onListItemClick = useCallback(
    (to: string) => {
      setActiveTerminalId(null);
      setTerminalViewVisible(false);
      navigate(to);
      onClick?.();
    },
    [navigate, onClick, setActiveTerminalId, setTerminalViewVisible],
  );

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {MENU_SECTIONS.map((section) => (
        <ul className={styles.list} key={section.id}>
          {section.items.map((item) => {
            const isActive = !!matchPath(
              { path: item.to, end: true },
              pathname,
            );
            const Icon = item.icon;

            return (
              <li key={item.to} className={styles.item}>
                <button
                  type="button"
                  className={`${styles.itemBtn}${isActive ? ` ${styles.active}` : ""}`}
                  onClick={() => onListItemClick(item.to)}
                >
                  <Icon className={styles.itemIcon} />
                  <span className={styles.itemText}>{item.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
