import { Theme } from "@radix-ui/themes";
import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useAppearanceValue } from "shared";
import { useAutoCheckUpdate } from "@/atom/updateAtom";
import RouterErrorBoundary from "@/components/RouterErrorBoundary";
import UpdateDialog from "@/components/UpdateDialog";
import Root from "../routes/Root";
import styles from "./index.module.less";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RouterErrorBoundary,
    children: [
      {
        path: "/",
        Component: lazy(() => import("../routes/Hosts")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/port-forwardings",
        Component: lazy(() => import("../routes/PortForwardings")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/keys",
        Component: lazy(() => import("../routes/Keys")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/known-hosts",
        Component: lazy(() => import("../routes/KnownHosts")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/settings",
        Component: lazy(() => import("../routes/Settings")),
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
  const appearance = useAppearanceValue();
  useAutoCheckUpdate();

  return (
    <Theme
      className={styles.app}
      hasBackground
      appearance={appearance}
      accentColor="indigo"
      grayColor="auto"
      panelBackground="translucent"
      radius="medium"
      scaling="100%"
    >
      <RouterProvider router={router} />
      <UpdateDialog />
    </Theme>
  );
}
