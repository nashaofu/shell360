import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
  Paper,
  Icon,
} from '@mui/material';
import { useHosts } from 'shared';

interface ProxyJumpChainEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
  currentHostId?: string;
}

export default function ProxyJumpChainEditor({
  value,
  onChange,
  currentHostId,
}: ProxyJumpChainEditorProps) {
  const { data: hosts } = useHosts();
  const [selectedHostId, setSelectedHostId] = useState<string>('');

  const availableHosts = hosts.filter(
    (host) => host.id !== currentHostId && !value.includes(host.id)
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
      [newChain[index - 1], newChain[index]] = [newChain[index], newChain[index - 1]];
      onChange(newChain);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < value.length - 1) {
      const newChain = [...value];
      [newChain[index], newChain[index + 1]] = [newChain[index + 1], newChain[index]];
      onChange(newChain);
    }
  };

  const getHostName = (hostId: string) => {
    const host = hosts.find((h) => h.id === hostId);
    return host ? host.name || host.hostname : 'Unknown';
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Proxy Jump Chain (Multi-level)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Configure multiple jump hosts in order. Connection will go through each host sequentially.
      </Typography>

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

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Add jump host"
          value={selectedHostId}
          onChange={(e) => setSelectedHostId(e.target.value)}
          disabled={availableHosts.length === 0}
        >
          {availableHosts.length === 0 ? (
            <MenuItem value="">
              <em>No available hosts</em>
            </MenuItem>
          ) : (
            availableHosts.map((host) => (
              <MenuItem key={host.id} value={host.id}>
                {host.name || host.hostname}
              </MenuItem>
            ))
          )}
        </TextField>
        <Button
          variant="outlined"
          onClick={handleAdd}
          disabled={!selectedHostId}
          startIcon={<Icon className="icon-add" />}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}
