import type { IDockviewPanelProps } from "dockview-react";
import { useTerminalsAtomValue, useTerminalsAtomWithApi } from "shared";
import SSHTerminal from "@/components/SSHTerminal";

export default function TerminalPanel({
  params,
  api,
}: IDockviewPanelProps<{ terminalId: string; onOpenAddKey: () => void }>) {
  const { terminalId, onOpenAddKey } = params;
  const terminalsState = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const term = terminalsState.get(terminalId);

  if (!term) return null;

  return (
    <SSHTerminal
      item={term}
      style={{ width: "100%", height: "100%" }}
      onClose={() => {
        api.close();
        terminalsApi.delete(terminalId);
      }}
      onOpenAddKey={onOpenAddKey}
    />
  );
}
