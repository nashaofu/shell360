import { getHosts } from 'tauri-plugin-data';

import { useSWR } from './useSWR';

export function useHosts() {
  const { data, loading, error, refresh } = useSWR('getHosts', getHosts);

  return {
    data: data ?? [],
    loading,
    error,
    refresh,
  };
}
