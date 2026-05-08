import { type ReactNode, useMemo } from "react";
import { v4 as uuidV4 } from "uuid";

import { useHosts } from "@/hooks/useHosts";

import { Dropdown } from "../Dropdown";
import styles from "./index.module.scss";

interface Tag {
  label: string;
  value: string;
}

export type HostTagsSelectChildProps = {
  onChangeOpen: (target: HTMLElement | null) => void;
  label: string;
};

export type HostTagsSelectProps = {
  value: string | undefined;
  onChange: (tag: string | undefined) => void;
  children: (props: HostTagsSelectChildProps) => ReactNode;
};

const ALL_TAG_VALUE = `ALL_TAG_VALUE:${uuidV4()}`;

export function HostTagsSelect({
  value = ALL_TAG_VALUE,
  onChange,
  children,
}: HostTagsSelectProps) {
  const { data: hosts = [] } = useHosts();

  const tags = useMemo(() => {
    const tagsSet = hosts.reduce((set, item) => {
      item.tags?.forEach((tag) => {
        set.add(tag);
      });
      return set;
    }, new Set<string>());

    return Array.from(tagsSet).reduce<Tag[]>(
      (acc, tag) => {
        acc.push({
          label: tag,
          value: tag,
        });
        return acc;
      },
      [
        {
          label: "All",
          value: ALL_TAG_VALUE,
        },
      ],
    );
  }, [hosts]);

  const tagsMap = useMemo(() => {
    return tags.reduce((map, tag) => {
      map.set(tag.value, tag.label);
      return map;
    }, new Map<string, string>());
  }, [tags]);

  const tagsMenus = useMemo(() => {
    return tags.map((item) => ({
      label: (
        <span className={styles.menuLabel}>
          <span
            className={
              value === item.value ? styles.radioChecked : styles.radio
            }
            aria-hidden="true"
          />
          <span className={styles.menuText}>{item.label}</span>
        </span>
      ),
      value: String(item.value),
      selected: value === item.value,
      onClick: () => {
        if (item.value === ALL_TAG_VALUE) {
          onChange(undefined);
        } else {
          onChange(item.value);
        }
      },
    }));
  }, [value, onChange, tags]);

  return (
    <Dropdown menus={tagsMenus}>
      {({ onChangeOpen }) =>
        children({ onChangeOpen, label: tagsMap.get(value) || "All" })
      }
    </Dropdown>
  );
}
