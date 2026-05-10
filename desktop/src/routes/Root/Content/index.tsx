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
import { TITLE_BAR_HEIGHT } from "@/constants/titleBar";
import Sidebar from "../Sidebar";
import Terminals from "../Terminals";
import styles from "./index.module.less";

export default function Content() {
  const match = useMatch("/terminal/:uuid");
  const isShowTerminal = !!match?.params.uuid;
  // const terminals = useTerminalsAtomValue();

  useHosts();
  useKeys();
  usePortForwardings();

  // const activeTerminal = useMemo(
  //   () => terminals.get(match?.params.uuid as string),
  //   [terminals, match?.params.uuid],
  // );

  // useLayoutEffect(() => {
  //   const defaultBackground =
  //     resolvedThemeMode === ThemeMode.Dark
  //       ? APP_BACKGROUND_COLOR.dark
  //       : APP_BACKGROUND_COLOR.light;

  //   const theme =
  //     TERMINAL_THEMES_MAP.get(
  //       activeTerminal?.host.terminalSettings?.theme as string,
  //     ) ?? TERMINAL_THEMES[0];

  //   const isLoading =
  //     activeTerminal?.jumpHostChain.some(
  //       (it) => it.status !== "authenticated" || it.loading || it.error,
  //     ) || activeTerminal?.status !== "success";

  //   const bgColor = isLoading
  //     ? defaultBackground
  //     : (theme.theme.background ?? defaultBackground);

  //   colorsAtomWithApi.setColors({
  //     bgColor,
  //     titleBarColor: getContrastTextColor(bgColor),
  //   });
  // }, [resolvedThemeMode, activeTerminal, colorsAtomWithApi.setColors]);

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
