import { useMemo, useState } from "react";
import type { HookModalProps } from "@/shared/ui/HookModal";

type HookConfig = Omit<HookModalProps, "open" | "hideCancel" | "hideOk">;
type HookConfigWithoutCancel = Omit<
  HookConfig,
  "cancelText" | "CancelButtonProps"
>;

function createStatusIcon(name: string, color: string) {
  return <span className={name} style={{ fontSize: 32, color }} />;
}

export default function useModal() {
  const [, setOpen] = useState(false);
  const [, setModalProps] = useState<Omit<HookModalProps, "open">>({});

  const fns = useMemo(
    () => ({
      info: ({ icon, onOk, ...props }: HookConfigWithoutCancel) => {
        setOpen(true);
        setModalProps({
          ...props,
          icon: icon || createStatusIcon("icon-info-circle", "var(--blue-11)"),
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
            icon || createStatusIcon("icon-success-circle", "var(--green-11)"),
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
          icon: icon || createStatusIcon("icon-error-circle", "var(--red-11)"),
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
            icon || createStatusIcon("icon-warning-circle", "var(--amber-11)"),
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

  return fns;
}
