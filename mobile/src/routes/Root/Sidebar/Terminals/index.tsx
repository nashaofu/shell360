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
import { type TerminalAtom, useTerminalsAtomWithApi } from 'shared';

type TerminalsProps = {
  onClick?: () => unknown;
};

export default function Terminals({ onClick }: TerminalsProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const onListItemClick = useCallback(
    (item: TerminalAtom) => {
      navigate(`/terminal/${item.uuid}`);
      onClick?.();
    },
    [navigate, onClick]
  );

  return (
    <List>
      {[...terminalsAtomWithApi.state.values()].map((item) => (
        <ListItem
          key={item.uuid}
          disablePadding
          onClick={() => onListItemClick(item)}
        >
          <ListItemButton
            selected={
              !!matchPath(
                {
                  path: `/terminal/${item.uuid}`,
                  end: true,
                },
                pathname
              )
            }
          >
            <ListItemIcon>
              <Icon className="icon-terminal" />
            </ListItemIcon>
            <ListItemText primary={item.name} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
