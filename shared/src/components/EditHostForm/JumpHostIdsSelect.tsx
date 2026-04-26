import { Button, IconButton, Select, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import type { Host } from "tauri-plugin-data";
import { useHosts } from "../../hooks/useHosts";
import { getHostName } from "../../utils/host";
import { resolveSpacing } from "../../utils/style";
import { AddIcon, ArrowDownIcon, ArrowUpIcon, DeleteIcon } from "../Icon";
import styles from "./JumpHostIdsSelect.module.less";

function getJumpHostName(
  hostMap: Map<string, Host>,
  hostId: string,
  index: number,
) {
  const host = hostMap.get(hostId);
  if (!host) {
    return `${index + 1}. Unknown(${hostId})`;
  }

  return `${index + 1}. ${getHostName(host)}`;
}

interface JumpHostIdsSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  hostId?: string;
  sx?: unknown;
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
  const [selectedHostId, setSelectedHostId] = useState<string>("");

  const availableHosts = useMemo(
    () =>
      hosts.filter((host) => host.id !== hostId && !value.includes(host.id)),
    [hosts, hostId, value],
  );

  const hostsMap = useMemo(() => {
    return hosts.reduce((acc, host) => {
      acc.set(host.id, host);
      return acc;
    }, new Map<string, Host>());
  }, [hosts]);

  const handleAdd = () => {
    if (selectedHostId) {
      onChange([...value, selectedHostId]);
      setSelectedHostId("");
    }
  };

  const handleRemove = (index: number) => {
    const newItems = [...value];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newItems = [...value];
      [newItems[index - 1], newItems[index]] = [
        newItems[index],
        newItems[index - 1],
      ];
      onChange(newItems);
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

  const wrapperStyle = resolveSpacing(sx);

  return (
    <div className={styles.wrapper} style={wrapperStyle}>
      {value.length > 0 && (
        <div className={styles.selectedListCard}>
          <div className={styles.selectedList}>
            {value.map((item, index) => (
              <div key={item} className={styles.selectedItem}>
                <div className={styles.itemTextWrap}>
                  <Text as="div" size="2" truncate>
                    {getJumpHostName(hostsMap, item, index)}
                  </Text>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                  >{`Jump host #${index + 1}`}</Text>
                </div>
                <div className={styles.itemActions}>
                  <IconButton
                    type="button"
                    variant="outline"
                    color="gray"
                    size="1"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ArrowUpIcon />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="outline"
                    color="gray"
                    size="1"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === value.length - 1}
                  >
                    <ArrowDownIcon />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="outline"
                    color="gray"
                    size="1"
                    onClick={() => handleRemove(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.selectorRow}>
        <div className={styles.selectorField}>
          <Text
            as="label"
            size="2"
            weight="medium"
            className={styles.fieldLabel}
          >
            Select jump host
          </Text>
          <Select.Root
            value={selectedHostId}
            onValueChange={setSelectedHostId}
            disabled={availableHosts.length === 0}
          >
            <Select.Trigger
              style={{ width: "100%" }}
              placeholder="Select jump host"
            />
            <Select.Content>
              {availableHosts.map((host) => (
                <Select.Item key={host.id} value={host.id}>
                  {host.name || host.hostname}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          {helperText && (
            <Text size="1" color={error ? "red" : undefined}>
              {helperText}
            </Text>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          color="gray"
          onClick={handleAdd}
        >
          <AddIcon />
          Add
        </Button>
      </div>
    </div>
  );
}
