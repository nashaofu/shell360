import { useCallback, useEffect } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';

import SSHTerminal from '@/components/SSHTerminal';
import { TerminalAtom, useTerminalsAtomWithApi } from '@/atom/terminalsAtom';

export default function Terminals() {
  const match = useMatch('/terminal/:uuid');
  const navigate = useNavigate();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const onLoadingChange = useCallback(
    (item: TerminalAtom, loading: boolean) => {
      terminalsAtomWithApi.update({
        ...item,
        loading,
      });
    },
    [terminalsAtomWithApi]
  );

  const onClose = useCallback(
    (item: TerminalAtom) => {
      const [, items] = terminalsAtomWithApi.delete(item.uuid);
      if (match?.params.uuid === item.uuid) {
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
  }, [terminalsAtomWithApi, navigate]);

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
            host={item.host}
            onLoadingChange={(loading) => onLoadingChange(item, loading)}
            onClose={() => onClose(item)}
          />
        );
      })}
    </>
  );
}
