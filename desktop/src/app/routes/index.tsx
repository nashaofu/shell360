import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import RequireLocked from "@/app/guards/RequireLocked";
import RequireUnlock from "@/app/guards/RequireUnlock";
import AuthLayout from "@/app/layouts/AuthLayout";
import AppLayout from "@/app/layouts/AppLayout";
import RouterErrorBoundary from "@/app/routes/RouterErrorBoundary";

const router = createBrowserRouter([
  {
    Component: () => (
      <RequireUnlock>
        <AppLayout />
      </RequireUnlock>
    ),
    ErrorBoundary: RouterErrorBoundary,
    children: [
      {
        path: "/",
        Component: lazy(() => import("@/routes/Hosts")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/port-forwardings",
        Component: lazy(() => import("@/routes/PortForwardings")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/keys",
        Component: lazy(() => import("@/routes/Keys")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/known-hosts",
        Component: lazy(() => import("@/routes/KnownHosts")),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: "/settings",
        Component: lazy(() => import("@/routes/Settings")),
        ErrorBoundary: RouterErrorBoundary,
      },
    ],
  },
  {
    Component: () => (
      <RequireLocked>
        <AuthLayout />
      </RequireLocked>
    ),
    ErrorBoundary: RouterErrorBoundary,
    children: [
      {
        path: "/unlock",
        Component: lazy(() => import("@/routes/Unlock")),
        ErrorBoundary: RouterErrorBoundary,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
    ErrorBoundary: RouterErrorBoundary,
  },
]);

export default router;
