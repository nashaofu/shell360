import { useEffect, useRef, useState } from "react";

export default function useAutoRepeatGridTemplateColumns(width: number) {
  const gridElRef = useRef<HTMLDivElement>(null);

  const [gridTemplateColumns, setGridTemplateColumns] = useState(
    `repeat(auto-fill, ${width}px)`,
  );

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((item) => {
        if (item.target === gridElRef.current) {
          if (!item.contentRect.width) {
            setGridTemplateColumns(`repeat(auto-fill, ${width}px)`);
            return;
          }

          const count = Math.floor(item.contentRect.width / width);
          // minmax(0, 1fr) 保证子元素不被内容影响，导致宽度不一�?
          setGridTemplateColumns(`repeat(${count}, minmax(0, 1fr))`);
        }
      });
    });

    if (gridElRef.current) {
      resizeObserver.observe(gridElRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [width]);

  return {
    gridElRef,
    gridTemplateColumns,
  };
}
