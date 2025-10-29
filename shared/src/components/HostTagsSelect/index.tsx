import { useMemo, type ReactNode } from 'react';
import { Box, Radio } from '@mui/material';

import { useHosts } from '@/hooks/useHosts';

import { Dropdown } from '../Dropdown';

interface Tag {
  label: string;
  value?: string;
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

export function HostTagsSelect({
  value,
  onChange,
  children,
}: HostTagsSelectProps) {
  const { data: hosts = [] } = useHosts();

  const tags = useMemo(() => {
    const tagsSet = hosts.reduce((set, item) => {
      item.tags?.forEach((tag) => set.add(tag));
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
          label: 'All',
          value: undefined,
        },
      ]
    );
  }, [hosts]);

  const tagsMap = useMemo(() => {
    return tags.reduce((map, tag) => {
      map.set(tag.value, tag.label);
      return map;
    }, new Map<string | undefined, string>());
  }, [tags]);

  const tagsMenus = useMemo(() => {
    return tags.map((item) => ({
      label: (
        <Box sx={{ minWidth: 120 }}>
          <Radio size="small" checked={value === item.value} />
          <Box component="span" sx={{ paddingLeft: 0.5 }}>
            {item.label}
          </Box>
        </Box>
      ),
      value: item.value,
      selected: value === item.value,
      onClick: () => onChange(item.value),
    }));
  }, [value, onChange, tags]);

  return (
    <Dropdown menus={tagsMenus}>
      {({ onChangeOpen }) =>
        children({ onChangeOpen, label: tagsMap.get(value) || 'All' })
      }
    </Dropdown>
  );
}
