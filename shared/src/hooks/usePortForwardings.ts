import { getPortForwardings } from 'tauri-plugin-data';

import { useSWR } from './useSWR';

export function usePortForwardings() {
  const { data, loading, error, refresh } = useSWR(
    'getPortForwardings',
    getPortForwardings
  );

  return {
    data: data ?? [],
    loading,
    error,
    refresh,
  };
}
