import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { lazy } from 'react';
import { useAtomValue } from 'jotai';
import { SnackbarProvider } from 'notistack';

import { useModalsAtomValue } from '@/atom/modalsAtom';
import ErrorBoundaryFallback from '@/components/ErrorBoundaryFallback';
import RouterErrorBoundary from '@/components/RouterErrorBoundary';

import Contextmenu from './components/Contextmenu';
import UpdateDialog from './components/UpdateDialog';
import { useAutoCheckUpdate } from './atom/updateAtom';
import Root from './routes/Root';
import { themeAtom } from './atom/themeAtom';

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
  useAutoCheckUpdate();

  return (
    <SnackbarProvider>
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
