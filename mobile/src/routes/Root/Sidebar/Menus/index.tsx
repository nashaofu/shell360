import { useCallback } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  Icon,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';

const MENU_ITEMS = [
  {
    icon: 'icon-host',
    text: 'Hosts',
    to: '/',
  },
  {
    icon: 'icon-site-map',
    text: 'Port forwardings',
    to: '/port-forwardings',
  },
  {
    icon: 'icon-key',
    text: 'Keys',
    to: '/keys',
  },
  {
    icon: 'icon-fingerprint',
    text: 'Known hosts',
    to: '/known-hosts',
  },
];

type MenusProps = {
  onClick?: () => unknown;
};

export default function Menus({ onClick }: MenusProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onListItemClick = useCallback(
    (to: string) => {
      navigate(to);
      onClick?.();
    },
    [navigate, onClick],
  );

  return (
    <List>
      {MENU_ITEMS.map((item) => (
        <ListItem
          key={item.to}
          disablePadding
          onClick={() => onListItemClick(item.to)}
        >
          <ListItemButton
            selected={
              !!matchPath(
                {
                  path: item.to,
                  end: true,
                },
                pathname,
              )
            }
          >
            <ListItemIcon>
              <Icon className={item.icon} />
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
