import { matchPath, useLocation, useNavigate } from "react-router-dom";
import Logo from "../Sidebar/Logo";
import styles from "./index.module.less";

const NAV_ITEMS = [
  { icon: "icon-host", label: "Hosts", to: "/" },
  { icon: "icon-site-map", label: "Tunnels", to: "/port-forwardings" },
  { icon: "icon-key", label: "Identity", to: "/keys" },
  { icon: "icon-fingerprint", label: "Trust", to: "/known-hosts" },
  { icon: "icon-settings", label: "Settings", to: "/settings" },
];

export default function NavRail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className={styles.navRail}>
      <div className={styles.brandMark} title="Shell360">
        <Logo />
      </div>
      <div className={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const active = !!matchPath({ path: item.to, end: true }, pathname);

          return (
            <button
              key={item.to}
              type="button"
              className={`${styles.navItem}${active ? ` ${styles.active}` : ""}`}
              title={item.label}
              onClick={() => navigate(item.to, { replace: true })}
            >
              <span className={`${styles.navIcon} ${item.icon}`} />
              <span className={styles.navText}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
