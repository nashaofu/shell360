import {
  Box,
  ClickAwayListener,
  Icon,
  IconButton,
  InputBase,
} from '@mui/material';
import { useCallback, useRef, useState } from 'react';

type SftpFileSearchProps = {
  value: string;
  onChange: (value: string) => unknown;
};

export default function SftpFileSearch({
  value,
  onChange,
}: SftpFileSearchProps) {
  const [isShow, setIsShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onShow = useCallback(() => {
    setIsShow(true);
    inputRef.current?.focus();
  }, []);

  const onHide = useCallback(() => {
    if (value.length) {
      return;
    }

    setIsShow(false);
  }, [value]);

  return (
    <ClickAwayListener onClickAway={onHide}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          maxWidth: 120,
        }}
      >
        <IconButton onClick={onShow}>
          <Icon className="icon-search" />
        </IconButton>
        <InputBase
          inputRef={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          sx={{
            flex: 1,
            width: isShow ? 100 : 0,
            transitionProperty: 'width',
            transitionDuration: (theme) =>
              theme.transitions.duration.short + 'ms',
            transitionTimingFunction: (theme) =>
              theme.transitions.easing.easeInOut,
          }}
          placeholder="Filter"
        />
      </Box>
    </ClickAwayListener>
  );
}
