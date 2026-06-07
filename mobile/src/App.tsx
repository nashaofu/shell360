import { Theme } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { lazy } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ModalProvider } from "shared";
import { themeAtom } from "./atoms/theme.atom";
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
  const theme = useAtomValue(themeAtom);

  return (
    <Theme {...theme}>
      <ModalProvider
        appearance={theme.appearance as "light" | "dark" | undefined}
      >
        <div className={styles.appShell}>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </div>
      </ModalProvider>
    </Theme>
  );
}
