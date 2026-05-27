import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTerminalsAtomValue } from "shared";
import { useTerminalActiveId, useTerminalViewVisible } from "@/app/model/terminalPanelAtom";

export default function Terminal() {
  const { uuid } = useParams<{ uuid: string }>();
  const terminalsState = useTerminalsAtomValue();
  const [, setActiveTerminalId] = useTerminalActiveId();
  const [, setVisible] = useTerminalViewVisible();

  useEffect(() => {
    setVisible(true);
    if (uuid && terminalsState.has(uuid)) {
      setActiveTerminalId(uuid);
    }
    return () => setVisible(false);
  }, [uuid, terminalsState, setActiveTerminalId, setVisible]);

  if (terminalsState.size === 0) {
    return <Navigate to="/" replace />;
  }

  return null;
}
