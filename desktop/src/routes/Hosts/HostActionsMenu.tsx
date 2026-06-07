import { DropdownMenu } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { ContentCopyIcon, DeleteIcon, EditIcon, MoreIcon } from "shared";
import type { Host } from "tauri-plugin-data";

type HostActionsMenuProps = {
  host: Host;
  trigger?: ReactNode;
  onCopy: (host: Host) => void;
  onDelete: (host: Host) => void;
  onEdit: (host: Host) => void;
};

export default function HostActionsMenu({
  host,
  trigger,
  onCopy,
  onDelete,
  onEdit,
}: HostActionsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {trigger ?? (
          <button type="button">
            <MoreIcon width="12" height="12" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
        <DropdownMenu.Item onSelect={() => onEdit(host)}>
          <EditIcon style={{ marginRight: 8 }} />
          Edit
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => onCopy(host)}>
          <ContentCopyIcon style={{ marginRight: 8 }} />
          Copy
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => onDelete(host)}>
          <DeleteIcon style={{ marginRight: 8 }} />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
