import { useCallback, useRef } from 'react';

export function useMemoizedFn<T extends unknown[]>(
  fn: (this: unknown, ...args: T) => unknown
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const memoizedFn = useCallback(function (this: unknown, ...args: T) {
    return fnRef.current.apply(this, args);
  }, []);

  return memoizedFn;
}
