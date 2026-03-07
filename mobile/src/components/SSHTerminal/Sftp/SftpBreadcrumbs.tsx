import {
  Box,
  Breadcrumbs,
  Icon,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";

type SftpBreadcrumbsProps = {
  dirname?: string;
  onClick: (dir: string) => unknown;
  onNavigate?: (path: string) => Promise<boolean>;
};

export default function SftpBreadcrumbs({
  dirname = "/",
  onClick,
  onNavigate,
}: SftpBreadcrumbsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPath, setEditPath] = useState(dirname);

  const dirs = useMemo(() => {
    return dirname.split("/").filter((item) => !!item.length);
  }, [dirname]);

  const handleStartEdit = useCallback(() => {
    setEditPath(dirname);
    setIsEditing(true);
  }, [dirname]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditPath(dirname);
  }, [dirname]);

  const handleConfirmEdit = useCallback(async () => {
    if (!onNavigate) {
      onClick(editPath);
      setIsEditing(false);
      return;
    }

    // Normalize path
    let normalizedPath = editPath.trim();
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }

    const success = await onNavigate(normalizedPath);
    if (success) {
      setIsEditing(false);
    }
  }, [editPath, onClick, onNavigate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleConfirmEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleConfirmEdit, handleCancelEdit],
  );

  const items = dirs.map((item, index) => {
    const path = `/${dirs.slice(0, index + 1).join("/")}`;
    if (index < dirs.length - 1) {
      return (
        <Typography
          // biome-ignore lint/suspicious/noArrayIndexKey: 路径中的部分可能存在重复，但路径整体是唯一的
          key={item + index}
          sx={{
            cursor: "pointer",
            color: "text.primary",
          }}
          onClick={() => onClick(path)}
        >
          {item}
        </Typography>
      );
    } else {
      return (
        <Typography
          // biome-ignore lint/suspicious/noArrayIndexKey: 路径中的部分可能存在重复，但路径整体是唯一的
          key={item + index}
          sx={{
            color: "text.primary",
            cursor: "pointer",
          }}
          onClick={() => onClick(path)}
        >
          {item}
        </Typography>
      );
    }
  });

  if (isEditing) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pr: 1,
          flex: 1,
        }}
      >
        <TextField
          value={editPath}
          onChange={(e) => setEditPath(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          size="small"
          placeholder="Enter path..."
          sx={{
            flex: 1,
            "& .MuiInputBase-root": {
              fontFamily: "monospace",
              fontSize: "14px",
            },
          }}
        />
        <IconButton size="small" onClick={handleConfirmEdit} color="primary">
          <Icon className="icon-success-circle" fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleCancelEdit}>
          <Icon className="icon-close" fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        pr: 1,
      }}
    >
      <Typography
        sx={{
          pl: 1,
          pr: 1,
          color: "text.primary",
          cursor: "pointer",
        }}
        onClick={() => onClick("/")}
      >
        /
      </Typography>
      <Box
        onDoubleClick={handleStartEdit}
        sx={{
          cursor: "text",
        }}
      >
        <Breadcrumbs>{items}</Breadcrumbs>
      </Box>
      <IconButton size="small" onClick={handleStartEdit} sx={{ ml: 0.5 }}>
        <Icon className="icon-edit" fontSize="small" />
      </IconButton>
    </Box>
  );
}
