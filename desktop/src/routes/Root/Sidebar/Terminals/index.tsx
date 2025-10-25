import { type MouseEvent, useCallback } from 'react';
import {
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router-dom';
import {
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';

import { type TerminalAtom, useTerminalsAtomWithApi } from '@/atom/terminalsAtom';

type TerminalsProps = {
  expand?: boolean;
  onClick?: () => unknown;
};

export default function Terminals({ expand, onClick }: TerminalsProps) {
  const { pathname } = useLocation();
  const match = useMatch('/terminal/:uuid');
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const onListItemClick = useCallback(
    (item: TerminalAtom) => {
      navigate(`/terminal/${item.uuid}`, { replace: true });
      onClick?.();
    },
    [navigate, onClick],
  );

  const onListItemCloseClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, item: TerminalAtom) => {
      event.stopPropagation();
      const [, items] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const first = items?.[0];
        if (first) {
          navigate(`/terminal/${first.uuid}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    },
    [match?.params.uuid, navigate, terminalsAtomWithApi],
  );

  return (
    <List>
      {terminalsAtomWithApi.state.map((item) => (
        <ListItem
          key={item.uuid}
          disablePadding
          onClick={() => onListItemClick(item)}
          title={item.name}
        >
          <ListItemButton
            sx={{
              justifyContent: expand ? 'initial' : 'center',
            }}
            selected={
              !!matchPath(
                {
                  path: `/terminal/${item.uuid}`,
                  end: true,
                },
                pathname,
              )
            }
          >
            <ListItemIcon
              sx={{
                minWidth: 'unset',
                mr: expand ? 2 : 0,
                justifyContent: expand ? 'initial' : 'center',
              }}
            >
              <Icon className="icon-terminal" />
            </ListItemIcon>
            {expand && (
              <ListItemText
                primary={item.name}
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  '.MuiTypography-root': {
                    display: 'inline',
                  },
                }}
              />
            )}

            {expand && (
              <IconButton
                size="small"
                edge="end"
                onClick={(event) => onListItemCloseClick(event, item)}
                title="Close"
              >
                <Icon
                  sx={{
                    fontSize: 16,
                  }}
                  className="icon-close"
                />
              </IconButton>
            )}
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
