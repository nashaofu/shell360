import { last } from "lodash-es";
import { useMemo } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { useTerminalsAtomValue } from "shared";
import SftpBrowser from "@/components/SftpBrowser";

export default function SftpContent({
  params,
}: IDockviewPanelProps<{ terminalId: string }>) {
  const { terminalId } = params;
  const terminalsState = useTerminalsAtomValue();
  const term = terminalsState.get(terminalId);

  const session = useMemo(() => {
    if (!term) return undefined;
    const lastItem = last(term.jumpHostChain);
    if (lastItem?.status === "authenticated") {
      return lastItem.session;
    }
    return undefined;
  }, [term?.jumpHostChain]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <SftpBrowser session={session} />
    </div>
  );
}
