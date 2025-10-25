import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  TextField,
  Paper,
  Icon,
  SxProps,
  Theme,
} from '@mui/material';
import { useHosts } from 'shared';

interface JumpHostIdsSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  hostId?: string;
  sx?: SxProps<Theme>;
  error?: boolean;
  helperText?: string;
}

export default function JumpHostIdsSelect({
  value,
  onChange,
  hostId,
  sx,
  error,
  helperText,
}: JumpHostIdsSelectProps) {
  const { data: hosts } = useHosts();
  const [selectedHostId, setSelectedHostId] = useState<string>('');

  const availableHosts = useMemo(
    () =>
      hosts.filter((host) => host.id !== hostId && !value.includes(host.id)),
    [hosts, hostId, value]
  );

  const handleAdd = () => {
    if (selectedHostId) {
      onChange([...value, selectedHostId]);
      setSelectedHostId('');
    }
  };

  const handleRemove = (index: number) => {
    const newChain = [...value];
    newChain.splice(index, 1);
    onChange(newChain);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newChain = [...value];
      [newChain[index - 1], newChain[index]] = [
        newChain[index],
        newChain[index - 1],
      ];
      onChange(newChain);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < value.length - 1) {
      const newChain = [...value];
      [newChain[index], newChain[index + 1]] = [
        newChain[index + 1],
        newChain[index],
      ];
      onChange(newChain);
    }
  };

  const getHostName = (hostId: string) => {
    const host = hosts.find((h) => h.id === hostId);
    return host ? host.name || host.hostname : 'Unknown';
  };

  return (
    <Box sx={sx}>
      {value.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 2, p: 1 }}>
          <List dense>
            {value.map((hostId, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      <Icon className="icon-arrow-up" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === value.length - 1}
                    >
                      <Icon className="icon-arrow-down" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemove(index)}
                    >
                      <Icon className="icon-delete" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={`${index + 1}. ${getHostName(hostId)}`}
                  secondary={`Jump host #${index + 1}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Select jump host"
          value={selectedHostId}
          onChange={(e) => setSelectedHostId(e.target.value)}
          disabled={availableHosts.length === 0}
          error={error}
          helperText={helperText}
        >
          {availableHosts.map((host) => (
            <MenuItem key={host.id} value={host.id}>
              {host.name || host.hostname}
            </MenuItem>
          ))}
        </TextField>
        <Button
          sx={{ flexShrink: 0 }}
          variant="outlined"
          onClick={handleAdd}
          startIcon={<Icon className="icon-add" />}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}
