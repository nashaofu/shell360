import { ScrollArea } from "@radix-ui/themes";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TITLE_BAR_HEIGHT } from "@/constants/titleBar";
import styles from "./index.module.less";
import Logo from "./Logo";
import Menus from "./Menus";
import Terminals from "./Terminals";

export default function Sidebar() {
  const [expand, setExpand] = useState(true);
  const navigate = useNavigate();

  return (
    <div className={styles.sidebar}>
      <div
        className={styles.header}
        style={{
          marginTop: TITLE_BAR_HEIGHT,
          flexDirection: expand ? "row" : "column",
        }}
      >
        <Logo expand={expand} />
        <div
          className={styles.settingsBtn}
          onClick={() => navigate("/settings", { replace: true })}
        >
          <span className="icon-settings" />
        </div>
      </div>

      <div className={styles.divider} />

      <Menus expand={expand} />

      <div className={styles.divider} />

      <ScrollArea
        className={styles.scrollArea}
        type="hover"
        scrollbars="vertical"
      >
        <Terminals expand={expand} />
      </ScrollArea>

      <div className={styles.divider} />

      <div
        className={styles.expandBtn}
        onClick={() => setExpand((val) => !val)}
      >
        {expand ? (
          <span className="icon-arrow-left" />
        ) : (
          <span className="icon-arrow-right" />
        )}
      </div>
    </div>
  );
}
