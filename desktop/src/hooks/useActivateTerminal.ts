import { useCallback } from "react";
import { useSetTerminalActiveId, useSetTerminalViewVisible } from "@/atoms/terminalView.atom";

export function useActivateTerminal() {
  const setActiveTerminalId = useSetTerminalActiveId();
  const setVisible = useSetTerminalViewVisible();

  return useCallback(
    (uuid: string) => {
      setActiveTerminalId(uuid);
      setVisible(true);
    },
    [setActiveTerminalId, setVisible],
  );
}
