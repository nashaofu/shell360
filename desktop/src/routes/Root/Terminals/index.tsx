import { useCallback, useEffect, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { type TerminalAtom, useTerminalsAtomWithApi } from "shared";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SSHTerminal";

export default function Terminals() {
  const match = useMatch("/terminal/:uuid");
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

  const onClose = useCallback(
    (item: TerminalAtom) => {
      const [, map] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const first = map.values().next().value;
        if (first) {
          navigate(`/terminal/${first.uuid}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    },
    [match?.params.uuid, navigate, terminalsAtomWithApi],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在terminalsAtomWithApi.state.size变化时执行
  useEffect(() => {
    if (!terminalsAtomWithApi.state.size && match) {
      navigate("/", { replace: true });
    }
  }, [terminalsAtomWithApi.state.size, navigate]);

  return (
    <>
      {[...terminalsAtomWithApi.state.values()].map((item) => {
        const visible = match?.params.uuid === item.uuid;
        return (
          <SSHTerminal
            key={item.uuid}
            sx={{
              display: visible ? "flex" : "none",
              flexGrow: 1,
              flexShrink: 0,
            }}
            item={item}
            onClose={() => onClose(item)}
            onOpenAddKey={() => setAddKeyOpen(true)}
          />
        );
      })}
      <AddKey
        open={addKeyOpen}
        onCancel={() => setAddKeyOpen(false)}
        onOk={() => setAddKeyOpen(false)}
      />
    </>
  );
}
