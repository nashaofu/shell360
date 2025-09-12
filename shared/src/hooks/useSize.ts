import { RefObject, useLayoutEffect, useState } from 'react';

export type Size = { width: number; height: number };

export function useSize(
  elRef: RefObject<HTMLElement | null>
): Size | undefined {
  const [state, setState] = useState<Size | undefined>(() => {
    if (!elRef.current) {
      return;
    }

    return {
      width: elRef.current.clientWidth,
      height: elRef.current.clientHeight,
    };
  });

  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { clientWidth, clientHeight } = entry.target;

        setState({
          width: clientWidth,
          height: clientHeight,
        });
      });
    });

    if (elRef.current) {
      resizeObserver.observe(elRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [elRef]);

  return state;
}
