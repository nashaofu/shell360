import type { ReactNode } from "react";

import { CloseIcon, FilterIcon, SearchIcon } from "shared";
import styles from "./index.module.less";

type SearchToolbarProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onFilter?: () => void;
  filterTrigger?: ReactNode;
  activeFilterCount?: number;
  quickFilters?: ReactNode;
};

export default function SearchToolbar({
  value,
  placeholder,
  onChange,
  onClear,
  onFilter,
  filterTrigger,
  activeFilterCount,
  quickFilters,
}: SearchToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.row}>
        <div className={styles.searchBox}>
          <SearchIcon className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.input}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            aria-label={placeholder}
          />
          {!!value && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                onChange("");
                onClear?.();
              }}
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          )}
        </div>
        {filterTrigger
          ? filterTrigger
          : onFilter && (
              <button
                type="button"
                className={styles.filterBtn}
                onClick={onFilter}
                aria-label="Open filters"
                data-active={!!activeFilterCount}
              >
                <FilterIcon />
                {!!activeFilterCount && (
                  <span className={styles.filterBadge}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
      </div>
      {quickFilters && (
        <div className={styles.quickFilters}>{quickFilters}</div>
      )}
    </div>
  );
}
