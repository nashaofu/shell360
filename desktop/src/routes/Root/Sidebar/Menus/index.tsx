import { useCallback } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import styles from "./index.module.less";

const MENU_ITEMS = [
  { icon: "icon-host", text: "Hosts", to: "/" },
  { icon: "icon-site-map", text: "Port forwardings", to: "/port-forwardings" },
  { icon: "icon-key", text: "Keys", to: "/keys" },
  { icon: "icon-fingerprint", text: "Known hosts", to: "/known-hosts" },
];

type MenusProps = {
  expand?: boolean;
  onClick?: () => unknown;
};

export default function Menus({ expand, onClick }: MenusProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onListItemClick = useCallback(
    (to: string) => {
      navigate(to, { replace: true });
      onClick?.();
    },
    [navigate, onClick],
  );

  return (
    <ul className={styles.list}>
      {MENU_ITEMS.map((item) => {
        const isActive = !!matchPath({ path: item.to, end: true }, pathname);
        return (
          <li key={item.to} className={styles.item} title={item.text}>
            <button
              type="button"
              className={`${styles.itemBtn}${isActive ? ` ${styles.active}` : ""}`}
              onClick={() => onListItemClick(item.to)}
            >
              <span className={`${styles.itemIcon} ${item.icon}`} />
              {expand && <span className={styles.itemText}>{item.text}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
