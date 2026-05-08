import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SftpFileSearch.module.scss";

type SftpFileSearchProps = {
  value: string;
  onChange: (value: string) => unknown;
};

export default function SftpFileSearch({
  value,
  onChange,
}: SftpFileSearchProps) {
  const [isShow, setIsShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const onShow = useCallback(() => {
    setIsShow(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const onHide = useCallback(() => {
    if (value.length) {
      return;
    }

    setIsShow(false);
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }

      if (wrapperRef.current.contains(event.target as Node)) {
        return;
      }

      onHide();
    };

    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [onHide]);

  return (
    <div ref={wrapperRef} className={styles.root}>
      <button type="button" className={styles.searchButton} onClick={onShow}>
        <span className="icon-search" />
      </button>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          isShow ? `${styles.input} ${styles.inputShow}` : styles.input
        }
        placeholder="Filter"
      />
    </div>
  );
}
