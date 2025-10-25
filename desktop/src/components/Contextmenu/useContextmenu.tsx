import { Icon, ListItemIcon, ListItemText } from '@mui/material';
import { type ReactNode, useEffect } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

import { cut, copy, paste } from '@/utils/clipboard';

const editableNodeNames = ['INPUT', 'TEXTAREA'];

const getCutEl = (parentElement: EventTarget | null) => {
  if (!(parentElement instanceof HTMLElement)) {
    return null;
  }

  let current: HTMLElement | null = parentElement;
  while (current) {
    if (editableNodeNames.includes(current.nodeName)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
};

const getPasteEl = (parentElement: EventTarget | null) => {
  if (!(parentElement instanceof HTMLElement)) {
    return null;
  }

  let current: HTMLElement | null = parentElement;
  while (current) {
    const { dataset } = current;
    if (
      editableNodeNames.includes(current.nodeName)
      || dataset.paste === 'true'
    ) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
};

export type ContextmenuItem = {
  key: string | number;
  label: ReactNode;
  disabled?: boolean;
  onClick?: () => unknown;
};

export type ContextmenuState = {
  open: boolean;
  menus: ContextmenuItem[];
  x: number;
  y: number;
};

type UseContextmenuOpts = {
  setContextmenuState: (contextMenu: ContextmenuState) => unknown;
  onCloseContextmenu: () => unknown;
};

export default function useContextmenu({
  setContextmenuState,
  onCloseContextmenu,
}: UseContextmenuOpts) {
  useEffect(() => {
    const onContextMenu = async (event: MouseEvent) => {
      event.preventDefault();
      const { target } = event;
      const selection = window.getSelection();
      const selectText = selection?.toString();

      const cutEl = getCutEl(target);
      const pasteEl = getPasteEl(target);
      let data = '';
      try {
        data = await readText();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }

      const menus: ContextmenuItem[] = [
        {
          key: 'Cut',
          label: (
            <>
              <ListItemIcon>
                <Icon className="icon-content-cut" />
              </ListItemIcon>
              <ListItemText>Cut</ListItemText>
            </>
          ),
          disabled: !selectText?.length || !cutEl,
          onClick: () => {
            onCloseContextmenu();
            cut(cutEl);
            selection?.removeAllRanges();
          },
        },
        {
          key: 'Copy',
          label: (
            <>
              <ListItemIcon>
                <Icon className="icon-content-copy" />
              </ListItemIcon>
              <ListItemText>Copy</ListItemText>
            </>
          ),
          disabled: !selectText?.length,
          onClick: () => {
            onCloseContextmenu();
            copy(selectText);
            selection?.removeAllRanges();
          },
        },
        {
          key: 'Paste',
          label: (
            <>
              <ListItemIcon>
                <Icon className="icon-content-paste" />
              </ListItemIcon>
              <ListItemText>Paste</ListItemText>
            </>
          ),
          disabled: !data || !pasteEl,
          onClick: async () => {
            onCloseContextmenu();
            paste(pasteEl, data);
            selection?.removeAllRanges();
          },
        },
      ];

      if (menus.filter((item) => !item.disabled).length) {
        setContextmenuState({
          open: true,
          menus,
          x: event.clientX,
          y: event.clientY,
        });
      }
    };
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [onCloseContextmenu, setContextmenuState]);
}
