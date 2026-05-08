import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TITLE_BAR_HEIGHT } from "@/constants/titleBar";
import styles from "./index.module.less";

import Logo from "./Logo";
import Menus from "./Menus";
import Terminals from "./Terminals";

const MINI_WINDOW_WIDTH = 720;

export default function Sidebar() {
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const isMiniWindow = windowWidth < MINI_WINDOW_WIDTH;
  const [expand, setExpand] = useState(() => !isMiniWindow);
  const navigate = useNavigate();

  const drawerWidth = isMiniWindow ? 70 : expand ? 240 : 70;

  const onClickAway = useCallback(() => {
    if (isMiniWindow) {
      setExpand(false);
    }
  }, [isMiniWindow]);

  useEffect(() => {
    const onResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth < MINI_WINDOW_WIDTH) {
        setExpand(false);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      {isMiniWindow && expand && (
        <div className={styles.overlay} onClick={onClickAway} />
      )}
      <div className={styles.sidebar} style={{ width: drawerWidth }}>
        <div
          className={styles.header}
          style={{
            marginTop: TITLE_BAR_HEIGHT,
            flexDirection: expand ? "row" : "column",
          }}
        >
          <Logo expand={expand} />
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => navigate("/settings", { replace: true })}
          >
            <span className="icon-settings" />
          </button>
        </div>

        <hr className={styles.divider} />

        <Menus expand={expand} />

        <hr className={styles.divider} />

        <div className={styles.scrollArea}>
          <Terminals expand={expand} />
        </div>

        <hr className={styles.divider} />

        <button
          type="button"
          className={styles.expandBtn}
          onClick={() => setExpand((val) => !val)}
        >
          {expand ? (
            <span className="icon-arrow-left" />
          ) : (
            <span className="icon-arrow-right" />
          )}
        </button>
      </div>
    </>
  );
}
