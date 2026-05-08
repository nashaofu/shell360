import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidV4 } from "uuid";
import { useModalsAtomWithApi } from "@/atom/modalsAtom";
import HookModal, { type HookModalProps } from "@/components/HookModal";

type HookConfig = Omit<HookModalProps, "open" | "hideCancel" | "hideOk">;
type HookConfigWithoutCancel = Omit<
  HookConfig,
  "cancelText" | "CancelButtonProps"
>;

function createStatusIcon(name: string, color: string) {
  return <span className={name} style={{ fontSize: 32, color }} />;
}

export default function useModal() {
  const [open, setOpen] = useState(false);
  const [uuid] = useState(() => uuidV4());
  const [modelProps, setModalProps] = useState<Omit<HookModalProps, "open">>(
    {},
  );
  const modalsAtomWithApi = useModalsAtomWithApi();

  const modalsAtomWithApiRef = useRef(modalsAtomWithApi);
  modalsAtomWithApiRef.current = modalsAtomWithApi;

  const fns = useMemo(
    () => ({
      info: ({ icon, onOk, ...props }: HookConfigWithoutCancel) => {
        setOpen(true);
        setModalProps({
          ...props,
          icon:
            icon ||
            createStatusIcon("icon-info-circle", "var(--blue-11, #2563eb)"),
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
          icon:
            icon ||
            createStatusIcon("icon-success-circle", "var(--green-11, #15803d)"),
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
          icon:
            icon ||
            createStatusIcon("icon-error-circle", "var(--red-11, #b91c1c)"),
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
          icon:
            icon ||
            createStatusIcon("icon-warning-circle", "var(--amber-11, #b45309)"),
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在组件挂载和卸载时执行
  useEffect(() => {
    modalsAtomWithApi.add(
      uuid,
      <HookModal {...modelProps} key={uuid} open={open} />,
    );

    return () => {
      modalsAtomWithApi.delete(uuid);
    };
  }, []);

  useEffect(() => {
    modalsAtomWithApiRef.current.update(
      uuid,
      <HookModal {...modelProps} key={uuid} open={open} />,
    );
  }, [modelProps, open, uuid]);

  return fns;
}
