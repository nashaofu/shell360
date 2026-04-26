import { useCallback } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { FingerprintIcon, HostIcon, KeyIcon, SiteMapIcon } from "shared";
import styles from "./index.module.less";

const MENU_ITEMS = [
  { icon: <HostIcon className={styles.itemIcon} />, text: "Hosts", to: "/" },
  {
    icon: <SiteMapIcon className={styles.itemIcon} />,
    text: "Tunnels",
    to: "/port-forwardings",
  },
  { icon: <KeyIcon className={styles.itemIcon} />, text: "Keys", to: "/keys" },
  {
    icon: <FingerprintIcon className={styles.itemIcon} />,
    text: "Known hosts",
    to: "/known-hosts",
  },
];

type MenusProps = {
  onClick?: () => unknown;
};

export default function Menus({ onClick }: MenusProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onListItemClick = useCallback(
    (to: string) => {
      navigate(to);
      onClick?.();
    },
    [navigate, onClick],
  );

  return (
    <ul className={styles.list}>
      {MENU_ITEMS.map((item) => {
        const isActive = !!matchPath({ path: item.to, end: true }, pathname);
        return (
          <li key={item.to} className={styles.item}>
            <button
              type="button"
              className={`${styles.itemBtn}${isActive ? ` ${styles.active}` : ""}`}
              onClick={() => onListItemClick(item.to)}
            >
              {item.icon}
              <span className={styles.itemText}>{item.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
