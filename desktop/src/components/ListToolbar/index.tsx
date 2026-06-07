import clsx from "clsx";
import type { ReactNode } from "react";
import { GridIcon, ListIcon, SearchIcon } from "shared";
import type { ViewMode } from "@/hooks/useListView";
import panel from "@/styles/panel.module.less";

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
    <div className={panel.toolbar}>
      <span className={panel.title}>{title}</span>
      <label className={panel.search}>
        <SearchIcon className={panel.searchIcon} />
        <input
          className={panel.searchInput}
          value={keyword}
          placeholder={searchPlaceholder}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </label>
      {leading}
      {viewMode && onViewModeChange && (
        <div className={panel.toggleGroup}>
          <button
            type="button"
            className={clsx(
              panel.toggleButton,
              viewMode === "grid" && panel.toggleButtonActive,
            )}
            title="Grid view"
            onClick={() => onViewModeChange("grid")}
          >
            <GridIcon width="12" height="12" />
          </button>
          <button
            type="button"
            className={clsx(
              panel.toggleButton,
              viewMode === "list" && panel.toggleButtonActive,
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
