import { useRouteError } from 'react-router-dom';

import ErrorBoundaryFallback from '../ErrorBoundaryFallback';

export default function RouterErrorBoundary() {
  const error = useRouteError();

  return (
    <ErrorBoundaryFallback
      error={error}
      resetErrorBoundary={() => window.location.reload()}
    />
  );
}
