import { Theme } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { SnackbarProvider } from "notistack";
import { lazy } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { useModalsAtomValue } from "@/atom/modalsAtom";
import ErrorBoundaryFallback from "@/components/ErrorBoundaryFallback";
import RouterErrorBoundary from "@/components/RouterErrorBoundary";
import { resolvedThemeModeAtom, ThemeMode } from "./atom/themeAtom";
import { useAutoCheckUpdate } from "./atom/updateAtom";
import Contextmenu from "./components/Contextmenu";
import UpdateDialog from "./components/UpdateDialog";
import Root from "./routes/Root";
import styles from "./styles/App.module.scss";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RouterErrorBoundary,
    children: [
      {
        path: "/",
        Component: lazy(() => import("./routes/Hosts")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/port-forwardings",
        Component: lazy(() => import("./routes/PortForwardings")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/keys",
        Component: lazy(() => import("./routes/Keys")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/known-hosts",
        Component: lazy(() => import("./routes/KnownHosts")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/settings",
        Component: lazy(() => import("./routes/Settings")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "*",
        element: null,
        ErrorBoundary: RouterErrorBoundary,
      },
    ],
  },
]);

export default function App() {
  const resolvedThemeMode = useAtomValue(resolvedThemeModeAtom);
  const modalsAtomValue = useModalsAtomValue();
  useAutoCheckUpdate();

  return (
    <SnackbarProvider autoHideDuration={3000} disableWindowBlurListener>
      <Theme
        appearance={
          resolvedThemeMode === ThemeMode.Dark
            ? ThemeMode.Dark
            : ThemeMode.Light
        }
        accentColor="blue"
        grayColor="sand"
        panelBackground="translucent"
        radius="medium"
      >
        <div className={styles.appShell}>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <RouterProvider router={router} />
            <Contextmenu />
            <UpdateDialog />
            {modalsAtomValue.map((item) => item.element)}
          </ErrorBoundary>
        </div>
      </Theme>
    </SnackbarProvider>
  );
}
