import { Button, Dialog, Flex } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type HookModalProps = {
  open: boolean;
  icon?: ReactNode;
  title?: ReactNode;
  content?: ReactNode;
  hideCancel?: boolean;
  cancelText?: ReactNode;
  CancelButtonProps?: Omit<
    ComponentPropsWithoutRef<typeof Button>,
    "children" | "onClick"
  >;
  hideOk?: boolean;
  okText?: ReactNode;
  OkButtonProps?: Omit<
    ComponentPropsWithoutRef<typeof Button>,
    "children" | "onClick"
  >;
  onCancel?: () => unknown;
  onOk?: () => unknown;
};

export default function HookModal({
  open,
  icon,
  title,
  content,
  hideCancel,
  cancelText,
  CancelButtonProps,
  hideOk,
  okText,
  OkButtonProps,
  onCancel,
  onOk,
}: HookModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel?.();
      }}
    >
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>
          <Flex align="center" gap="2">
            {icon}
            {title}
          </Flex>
        </Dialog.Title>
        {content && (
          <Dialog.Description style={{ userSelect: "text" }}>
            {content}
          </Dialog.Description>
        )}
        <Flex gap="2" justify="end" mt="4">
          {!hideCancel && (
            <Button {...CancelButtonProps} variant="soft" onClick={onCancel}>
              {cancelText || "Cancel"}
            </Button>
          )}
          {!hideOk && (
            <Button {...OkButtonProps} onClick={onOk}>
              {okText || "Ok"}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
