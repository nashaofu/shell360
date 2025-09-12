import { ReactNode, useState } from 'react';
import {
  Box, Menu, MenuItem, MenuProps, SxProps, Theme,
} from '@mui/material';

type DropdownMenu = {
  label: ReactNode;
  value: string | number;
  onClick?: () => unknown;
};

type DropdownChildrenRenderProps = {
  open: boolean;
  onChangeOpen: (anchorEl: HTMLElement | null) => unknown;
};

type DropdownProps = Omit<
MenuProps,
'anchorEl' | 'open' | 'onClose' | 'sx' | 'children'
> & {
  sx?: SxProps<Theme>;
  menus?: DropdownMenu[];
  children: (props: DropdownChildrenRenderProps) => ReactNode;
};

export default function Dropdown({
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
        {menus.map((item) => (
          <MenuItem
            key={item.value}
            onClick={() => {
              item.onClick?.();
              setAnchorEl(null);
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
