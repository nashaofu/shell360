import { CssBaseline, ThemeProvider } from "@mui/material";
import { useAtomValue } from "jotai";
import { SnackbarProvider } from "notistack";
import { lazy } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { useModalsAtomValue } from "@/atom/modalsAtom";
import ErrorBoundaryFallback from "@/components/ErrorBoundaryFallback";
import RouterErrorBoundary from "@/components/RouterErrorBoundary";
import { themeAtom } from "./atom/themeAtom";
import { useAutoCheckUpdate } from "./atom/updateAtom";
import Contextmenu from "./components/Contextmenu";
import UpdateDialog from "./components/UpdateDialog";
import Root from "./routes/Root";

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
  const modalsAtomValue = useModalsAtomValue();
  useAutoCheckUpdate();

  return (
    <SnackbarProvider autoHideDuration={3000} disableWindowBlurListener>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <RouterProvider router={router} />
            <Contextmenu />
            <UpdateDialog />
            {modalsAtomValue.map((item) => item.element)}
          </ErrorBoundary>
        </CssBaseline>
      </ThemeProvider>
    </SnackbarProvider>
  );
}
