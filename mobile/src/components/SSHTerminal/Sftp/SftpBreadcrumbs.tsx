import { Box, Breadcrumbs, Typography } from '@mui/material';
import { useMemo } from 'react';

type SftpBreadcrumbsProps = {
  dirname?: string;
  onClick: (dir: string) => unknown;
};

export default function SftpBreadcrumbs({
  dirname = '/',
  onClick,
}: SftpBreadcrumbsProps) {
  const dirs = useMemo(() => {
    return dirname.split('/').filter((item) => !!item.length);
  }, [dirname]);

  const items = dirs.map((item, index) => {
    const path = `/${dirs.slice(0, index + 1).join('/')}`;
    if (index < dirs.length - 1) {
      return (
        <Typography
          key={item + index}
          sx={{
            cursor: 'pointer',
            color: 'text.primary',
          }}
          onClick={() => onClick(path)}
        >
          {item}
        </Typography>
      );
    } else {
      return (
        <Typography
          key={item + index}
          sx={{
            color: 'text.primary',
            cursor: 'pointer',
          }}
          onClick={() => onClick(path)}
        >
          {item}
        </Typography>
      );
    }
  });

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        pr: 1,
      }}
    >
      <Typography
        sx={{
          pl: 1,
          pr: 1,
          color: 'text.primary',
          cursor: 'pointer',
        }}
        onClick={() => onClick('/')}
      >
        /
      </Typography>
      <Breadcrumbs>{items}</Breadcrumbs>
    </Box>
  );
}
