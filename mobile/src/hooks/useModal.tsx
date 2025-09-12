import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { Icon } from '@mui/material';
import { v4 as uuidV4 } from 'uuid';

import HookModal, { HookModalProps } from '@/components/HookModal';
import { useModalsAtomWithApi } from '@/atom/modalsAtom';

type HookConfig = Omit<HookModalProps, 'open' | 'hideCancel' | 'hideOk'>;
type HookConfigWithoutCancel = Omit<
HookConfig,
'cancelText' | 'CancelButtonProps'
>;

export default function useModal() {
  const [open, setOpen] = useState(false);
  const [uuid] = useState(() => uuidV4());
  const [modelProps, setModalProps] = useState<Omit<HookModalProps, 'open'>>({});
  const modalsAtomWithApi = useModalsAtomWithApi();

  const modalsAtomWithApiRef = useRef(modalsAtomWithApi);
  modalsAtomWithApiRef.current = modalsAtomWithApi;

  const fns = useMemo(
    () => ({
      info: ({ icon, onOk, ...props }: HookConfigWithoutCancel) => {
        setOpen(true);
        setModalProps({
          ...props,
          icon: icon || (
            <Icon
              color="info"
              sx={{ fontSize: 32 }}
              className="icon-info-circle"
            />
          ),
          hideCancel: true,
          onOk: async () => {
            await onOk?.();
            setOpen(false);
          },
        });
      },
      success: ({ icon, onOk, ...props }: HookConfigWithoutCancel) => {
        setOpen(true);
        setModalProps({
          ...props,
          icon: icon || (
            <Icon
              color="success"
              sx={{ fontSize: 32 }}
              className="icon-success-circle"
            />
          ),
          hideCancel: true,
          onOk: async () => {
            await onOk?.();
            setOpen(false);
          },
        });
      },
      error: ({ icon, onOk, ...props }: HookConfigWithoutCancel) => {
        setOpen(true);
        setModalProps({
          ...props,
          icon: icon || (
            <Icon
              color="error"
              sx={{ fontSize: 32 }}
              className="icon-error-circle"
            />
          ),
          hideCancel: true,
          onOk: async () => {
            await onOk?.();
            setOpen(false);
          },
        });
      },
      warning: ({ icon, onOk, ...props }: HookConfigWithoutCancel) => {
        setOpen(true);
        setModalProps({
          ...props,
          icon: icon || (
            <Icon
              color="warning"
              sx={{ fontSize: 32 }}
              className="icon-warning-circle"
            />
          ),
          hideCancel: true,
          onOk: async () => {
            await onOk?.();
            setOpen(false);
          },
        });
      },
      confirm: ({ onOk, onCancel, ...props }: HookConfig) => {
        setOpen(true);
        setModalProps({
          ...props,
          onOk: async () => {
            await onOk?.();
            setOpen(false);
          },
          onCancel: async () => {
            await onCancel?.();
            setOpen(false);
          },
        });
      },
    }),
    [],
  );

  useEffect(() => {
    modalsAtomWithApi.add(
      uuid,
      <HookModal {...modelProps} key={uuid} open={open} />,
    );

    return () => {
      modalsAtomWithApi.delete(uuid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    modalsAtomWithApiRef.current.update(
      uuid,
      <HookModal {...modelProps} key={uuid} open={open} />,
    );
  }, [modelProps, open, uuid]);

  return fns;
}
