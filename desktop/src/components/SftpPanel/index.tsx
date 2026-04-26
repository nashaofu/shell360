import type { IDockviewPanelProps } from "dockview-react";
import { useTerminalsAtomValue, useTerminalsAtomWithApi } from "shared";
import SftpBrowser from "@/components/SftpBrowser";

export default function SftpContent({
  params,
  api,
}: IDockviewPanelProps<{ terminalId: string; onOpenAddKey: () => void }>) {
  const { terminalId, onOpenAddKey } = params;
  const terminalsState = useTerminalsAtomValue();
  const terminalsApi = useTerminalsAtomWithApi();
  const term = terminalsState.get(terminalId);

  if (!term) return null;

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <SftpBrowser
        item={term}
        onClose={() => {
          api.close();
          terminalsApi.delete(terminalId);
        }}
        onOpenAddKey={onOpenAddKey}
      />
    </div>
  );
}
