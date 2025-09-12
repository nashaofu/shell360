import { useCallback, useState } from 'react';
import { Menu, MenuItem } from '@mui/material';

import useContextmenu, { ContextmenuState } from './useContextmenu';

export default function Contextmenu() {
  const [contextmenuState, setContextmenuState] = useState<ContextmenuState>({
    open: false,
    menus: [],
    x: 0,
    y: 0,
  });

  const onCloseContextmenu = useCallback(() => {
    setContextmenuState({
      open: false,
      menus: [],
      x: 0,
      y: 0,
    });
  }, []);

  useContextmenu({
    setContextmenuState,
    onCloseContextmenu,
  });

  return (
    <Menu
      open={contextmenuState.open}
      anchorReference="anchorPosition"
      onClose={onCloseContextmenu}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      anchorPosition={{
        left: contextmenuState.x,
        top: contextmenuState.y,
      }}
      sx={{
        '& .MuiPaper-root': {
          minWidth: 200,
        },
      }}
    >
      {contextmenuState.menus.map((item) => (
        <MenuItem
          key={item.key}
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
