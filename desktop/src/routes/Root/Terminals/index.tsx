import { useCallback, useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { type TerminalAtom, useTerminalsAtomWithApi } from 'shared';

import SSHTerminal from '@/components/SSHTerminal';
import AddKey from '@/components/AddKey';

export default function Terminals() {
  const match = useMatch('/terminal/:uuid');
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();
  const [addKeyOpen, setAddKeyOpen] = useState(false);

  const onClose = useCallback(
    (item: TerminalAtom) => {
      terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
        const items = terminalsAtomWithApi.getState();
        const first = items[0];
        if (first) {
          navigate(`/terminal/${first.uuid}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    },
    [match?.params.uuid, navigate, terminalsAtomWithApi]
  );

  useEffect(() => {
    if (!terminalsAtomWithApi.state.length) {
      navigate('/', { replace: true });
    }
  }, [terminalsAtomWithApi.state.length, navigate]);

  return (
    <>
      {terminalsAtomWithApi.state.map((item) => {
        const visible = match?.params.uuid === item.uuid;
        return (
          <SSHTerminal
            key={item.uuid}
            sx={{
              display: visible ? 'flex' : 'none',
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
