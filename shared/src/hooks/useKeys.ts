import { getKeys } from 'tauri-plugin-data';

import { useSWR } from './useSWR';

export function useKeys() {
  const { data, loading, error, refresh } = useSWR('getKeys', getKeys);

  return {
    data: data ?? [],
    loading,
    error,
    refresh,
  };
}
