import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorsAtomValue } from "@/atom/colorsAtom";
import { TITLE_BAR_HEIGHT } from "@/constants/titleBar";
import styles from "./index.module.less";

function getContrastText(bg: string): string {
  const hex = bg.replace(/^#/, "");
  if (hex.length < 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5 ? "rgba(0,0,0,0.87)" : "#ffffff";
}

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const colorsAtomValue = useColorsAtomValue();

  const onClickMinimize = useCallback(() => {
    getCurrentWindow().minimize();
  }, []);

  const onClickToggleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize();
  }, []);

  const onClickClose = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  const hoverBg = useMemo(() => {
    const contrastText = getContrastText(colorsAtomValue.bgColor);
    return contrastText === "#ffffff"
      ? "rgba(255,255,255,0.07)"
      : "rgba(0,0,0,0.07)";
  }, [colorsAtomValue.bgColor]);

  useEffect(() => {
    getCurrentWindow().isMaximized().then(setIsMaximized);

    const unListen = getCurrentWindow().onResized(() => {
      getCurrentWindow().isMaximized().then(setIsMaximized);
    });

    return () => {
      unListen.then((fn) => fn());
    };
  }, []);

  return (
    <div
      className={styles.titleBar}
      style={{
        height: TITLE_BAR_HEIGHT,
        color: colorsAtomValue.titleBarColor,
        ["--titlebar-height" as string]: `${TITLE_BAR_HEIGHT}px`,
        ["--titlebar-btn-hover" as string]: hoverBg,
      }}
    >
      <div className={styles.dragRegion} data-tauri-drag-region="true" />
      {import.meta.env.TAURI_ENV_PLATFORM !== "darwin" && (
        <div className={styles.winControls}>
          <button
            type="button"
            className={styles.winBtn}
            onClick={onClickMinimize}
          >
            <span className="icon-window-minimize" />
          </button>
          <button
            type="button"
            className={styles.winBtn}
            onClick={onClickToggleMaximize}
          >
            {isMaximized ? (
              <span className="icon-window-restore" />
            ) : (
              <span className="icon-window-maximize" />
            )}
          </button>
          <button
            type="button"
            className={styles.winBtn}
            onClick={onClickClose}
          >
            <span className="icon-window-close" />
          </button>
        </div>
      )}
    </div>
  );
}
