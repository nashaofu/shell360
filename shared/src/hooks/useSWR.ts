import { atom, useAtom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { useEffect, useRef } from 'react';
import { useMemoizedFn } from 'ahooks';

export interface SWRAtom<T> {
  loading: boolean;
  data?: T;
  error?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const swrFamily = atomFamily(() => atom<SWRAtom<any> | undefined>(undefined));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SWR_PROMISE_CACHE = new Map<string, Promise<any>>();

export function useSWR<T>(key: string, fn: () => Promise<T>) {
  const [state, setState] = useAtom<SWRAtom<T> | undefined>(swrFamily(key));
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useMemoizedFn(async () => {
    setState({
      loading: true,
      data: stateRef.current?.data,
      error: undefined,
    });

    if (!SWR_PROMISE_CACHE.has(key)) {
      SWR_PROMISE_CACHE.set(key, fn());
    }

    try {
      const data = await SWR_PROMISE_CACHE.get(key);

      setState({
        loading: false,
        data: data,
        error: undefined,
      });
      return data;
    } catch (error) {
      setState({
        loading: false,
        data: stateRef.current?.data,
        error,
      });

      throw error;
    } finally {
      SWR_PROMISE_CACHE.delete(key);
    }
  });

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [key, refresh]);

  useEffect(() => {
    if (!stateRef.current) {
      refresh();
    }
  }, [refresh]);

  return {
    data: state?.data,
    loading: state?.loading ?? false,
    error: state?.error,
    refresh,
  };
}
