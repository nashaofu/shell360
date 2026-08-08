import clsx from "clsx";
import type { ReactNode } from "react";
import { GridIcon, ListIcon, SearchIcon } from "shared";
import type { ViewMode } from "@/hooks/useListView";
import styles from "./index.module.less";

type ListToolbarProps = {
  title: string;
  keyword: string;
  onKeywordChange: (value: string) => void;
  searchPlaceholder?: string;
  leading?: ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  children?: ReactNode;
};

export default function ListToolbar({
  title,
  keyword,
  onKeywordChange,
  searchPlaceholder,
  leading,
  viewMode,
  onViewModeChange,
  children,
}: ListToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.title}>{title}</span>
      <label className={styles.search}>
        <SearchIcon className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          value={keyword}
          placeholder={searchPlaceholder}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </label>
      {leading}
      {viewMode && onViewModeChange && (
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={clsx(
              styles.toggleButton,
              viewMode === "grid" && styles.toggleButtonActive,
            )}
            title="Grid view"
            onClick={() => onViewModeChange("grid")}
          >
            <GridIcon width="12" height="12" />
          </button>
          <button
            type="button"
            className={clsx(
              styles.toggleButton,
              viewMode === "list" && styles.toggleButtonActive,
            )}
            title="List view"
            onClick={() => onViewModeChange("list")}
          >
            <ListIcon width="12" height="12" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
