import { type ReactNode, useState } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  type MenuItemProps,
  type MenuProps,
  type SxProps,
  type Theme,
} from '@mui/material';

export type DropdownMenu = {
  label: ReactNode;
  value: string | number;
  onClick?: () => unknown;
} & MenuItemProps;

export type DropdownChildrenRenderProps = {
  open: boolean;
  onChangeOpen: (anchorEl: HTMLElement | null) => unknown;
};

export type DropdownProps = Omit<
  MenuProps,
  'anchorEl' | 'open' | 'onClose' | 'sx' | 'children'
> & {
  sx?: SxProps<Theme>;
  menus?: DropdownMenu[];
  children: (props: DropdownChildrenRenderProps) => ReactNode;
};

export function Dropdown({
  sx,
  menus = [],
  children,
  ...props
}: DropdownProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Box sx={sx}>
      {children({
        open: !!anchorEl,
        onChangeOpen: setAnchorEl,
      })}
      <Menu
        {...props}
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        {menus.map(({ value, label, onClick, ...item }) => (
          <MenuItem
            {...item}
            key={value}
            onClick={() => {
              onClick?.();
              setAnchorEl(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
