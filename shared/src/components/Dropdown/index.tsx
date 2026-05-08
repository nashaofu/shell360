import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./index.module.scss";

export type DropdownMenu = {
  label: ReactNode;
  value: string | number;
  onClick?: () => unknown;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
};

export type DropdownChildrenRenderProps = {
  open: boolean;
  onChangeOpen: (anchorEl: HTMLElement | null) => unknown;
};

type Origin = {
  vertical: "top" | "bottom";
  horizontal: "left" | "center" | "right";
};

export type DropdownProps = {
  sx?: unknown;
  className?: string;
  menus?: DropdownMenu[];
  anchorOrigin?: Origin;
  transformOrigin?: Origin;
  onClose?: () => void;
  children: (props: DropdownChildrenRenderProps) => ReactNode;
};

export function Dropdown({
  sx,
  className,
  menus = [],
  anchorOrigin = { vertical: "bottom", horizontal: "left" },
  transformOrigin = { vertical: "top", horizontal: "left" },
  onClose,
  children,
}: DropdownProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setAnchorEl(null);
    onClose?.();
  };

  const wrapperStyle =
    (sx && typeof sx === "object" ? (sx as CSSProperties) : undefined) ||
    undefined;

  const menuStyle = useMemo<CSSProperties>(() => {
    if (!anchorEl) {
      return { display: "none" };
    }

    const rect = anchorEl.getBoundingClientRect();
    const topBase = anchorOrigin.vertical === "bottom" ? rect.bottom : rect.top;
    const leftBase =
      anchorOrigin.horizontal === "right"
        ? rect.right
        : anchorOrigin.horizontal === "center"
          ? rect.left + rect.width / 2
          : rect.left;

    const translateY = transformOrigin.vertical === "top" ? 0 : -100;
    const translateX =
      transformOrigin.horizontal === "left"
        ? 0
        : transformOrigin.horizontal === "center"
          ? -50
          : -100;

    const wrapperRect = anchorEl.offsetParent
      ? (anchorEl.offsetParent as HTMLElement).getBoundingClientRect()
      : { top: 0, left: 0 };

    return {
      position: "absolute",
      top: `${topBase - wrapperRect.top}px`,
      left: `${leftBase - wrapperRect.left}px`,
      transform: `translate(${translateX}%, ${translateY}%)`,
      zIndex: 1400,
    };
  }, [anchorEl, anchorOrigin, transformOrigin]);

  useEffect(() => {
    if (!anchorEl) {
      return;
    }

    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      const menuNode = menuRef.current;

      if (menuNode?.contains(target) || anchorEl.contains(target)) {
        return;
      }

      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorEl]);

  const onMenuItemClick =
    (item: DropdownMenu) => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (item.disabled) {
        return;
      }
      item.onClick?.();
      close();
    };

  return (
    <div
      className={[styles.root, className || ""].filter(Boolean).join(" ")}
      style={wrapperStyle}
    >
      {children({
        open: !!anchorEl,
        onChangeOpen: setAnchorEl,
      })}

      {anchorEl && (
        <div className={styles.menu} ref={menuRef} style={menuStyle}>
          {menus.map((item) => (
            <button
              key={item.value}
              type="button"
              className={[
                styles.menuItem,
                item.selected ? styles.menuItemSelected : "",
                item.className || "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={item.disabled}
              onClick={onMenuItemClick(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
