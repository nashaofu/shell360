import { useCallback } from "react";
import { useSetTerminalActiveId, useSetTerminalViewVisible } from "@/atoms/terminal";

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
