import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { lazy } from 'react';
import { ThemeProvider } from '@emotion/react';
import { CssBaseline } from '@mui/material';
import { useAtomValue } from 'jotai';
import { ErrorBoundary } from 'react-error-boundary';
import { SnackbarProvider } from 'notistack';

import RouterErrorBoundary from './components/RouterErrorBoundary';
import Root from './routes/Root';
import { themeAtom } from './atom/themeAtom';
import ErrorBoundaryFallback from './components/ErrorBoundaryFallback';
import { useModalsAtomValue } from './atom/modalsAtom';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    ErrorBoundary: RouterErrorBoundary,
    children: [
      {
        path: '/',
        Component: lazy(() => import('./routes/Hosts')),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: '/port-forwardings',
        Component: lazy(() => import('./routes/PortForwardings')),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: '/keys',
        Component: lazy(() => import('./routes/Keys')),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: '/known-hosts',
        Component: lazy(() => import('./routes/KnownHosts')),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: '/settings',
        Component: lazy(() => import('./routes/Settings')),
        ErrorBoundary: RouterErrorBoundary,
      },
      {
        path: '*',
        element: null,
        ErrorBoundary: RouterErrorBoundary,
      },
    ],
  },
]);

export default function App() {
  const theme = useAtomValue(themeAtom);
  const modalsAtomValue = useModalsAtomValue();

  return (
    <SnackbarProvider
      dense
      autoHideDuration={3000}
      disableWindowBlurListener
      classes={{
        root: 'notistack-snackbar-root',
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <RouterProvider router={router} />
            {modalsAtomValue.map((item) => item.element)}
          </ErrorBoundary>
        </CssBaseline>
      </ThemeProvider>
    </SnackbarProvider>
  );
}
