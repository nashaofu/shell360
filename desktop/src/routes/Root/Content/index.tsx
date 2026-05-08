import { useAtomValue } from "jotai";
import { Suspense, useLayoutEffect, useMemo } from "react";
import { Outlet, useMatch } from "react-router-dom";
import {
  TERMINAL_THEMES,
  TERMINAL_THEMES_MAP,
  useHosts,
  useKeys,
  usePortForwardings,
  useTerminalsAtomValue,
} from "shared";
import { useColorsAtomWithApi } from "@/atom/colorsAtom";
import { themeAtom } from "@/atom/themeAtom";
import { TITLE_BAR_HEIGHT } from "@/constants/titleBar";
import styles from "./index.module.less";

import Sidebar from "../Sidebar";
import Terminals from "../Terminals";

export default function Content() {
  const match = useMatch("/terminal/:uuid");
  const isShowTerminal = !!match?.params.uuid;
  const terminals = useTerminalsAtomValue();
  const colorsAtomWithApi = useColorsAtomWithApi();

  const themeValue = useAtomValue(themeAtom);

  useHosts();
  useKeys();
  usePortForwardings();

  const activeTerminal = useMemo(
    () => terminals.get(match?.params.uuid as string),
    [terminals, match?.params.uuid],
  );

  useLayoutEffect(() => {
    const defaultBackground = themeValue.palette.background.default;
    const theme =
      TERMINAL_THEMES_MAP.get(
        activeTerminal?.host.terminalSettings?.theme as string,
      ) ?? TERMINAL_THEMES[0];

    const isLoading =
      activeTerminal?.jumpHostChain.some(
        (it) => it.status !== "authenticated" || it.loading || it.error,
      ) || activeTerminal?.status !== "success";

    const bgColor = isLoading
      ? defaultBackground
      : (theme.theme.background ?? defaultBackground);

    colorsAtomWithApi.setColors({
      bgColor,
      titleBarColor: themeValue.palette.getContrastText(bgColor),
    });
  }, [themeValue.palette, activeTerminal, colorsAtomWithApi.setColors]);

  return (
    <>
      <Sidebar />
      <div
        className={styles.contentRoot}
        style={{ marginTop: `${TITLE_BAR_HEIGHT}px` }}
      >
        <div
          className={
            !isShowTerminal
              ? styles.pageLayer
              : `${styles.pageLayer} ${styles.hidden}`
          }
        >
          <Suspense>
            <Outlet />
          </Suspense>
        </div>
        <div
          className={
            isShowTerminal
              ? styles.terminalLayer
              : `${styles.terminalLayer} ${styles.hidden}`
          }
        >
          <Terminals />
        </div>
      </div>
    </>
  );
}
