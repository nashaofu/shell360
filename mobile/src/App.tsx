import { Theme } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { SnackbarProvider } from "notistack";
import { lazy } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useModalsAtomValue } from "./atom/modalsAtom";
import { resolvedThemeModeAtom, ThemeMode } from "./atom/themeAtom";
import ErrorBoundaryFallback from "./components/ErrorBoundaryFallback";
import RouterErrorBoundary from "./components/RouterErrorBoundary";
import Root from "./routes/Root";
import styles from "./styles/App.module.less";

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

  return (
    <SnackbarProvider
      dense
      autoHideDuration={3000}
      disableWindowBlurListener
      classes={{
        root: "notistack-snackbar-root",
      }}
    >
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
            {modalsAtomValue.map((item) => item.element)}
          </ErrorBoundary>
        </div>
      </Theme>
    </SnackbarProvider>
  );
}
