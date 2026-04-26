import { Button, Flex } from "@radix-ui/themes";
import type { ReactNode } from "react";

type DrawerFooterProps = {
  loading?: boolean;
  cancelLabel?: string;
  submitLabel?: string;
  extra?: ReactNode;
  onCancel: () => unknown;
  onSubmit: () => unknown;
};

export default function DrawerFooter({
  loading,
  cancelLabel = "Cancel",
  submitLabel = "Save",
  extra,
  onCancel,
  onSubmit,
}: DrawerFooterProps) {
  return (
    <Flex align="center" gap="2">
      <Button
        style={{ flex: 1 }}
        variant="outline"
        loading={loading}
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
      <Flex style={{ flex: 1 }} gap="1">
        <Button style={{ flex: 1 }} loading={loading} onClick={onSubmit}>
          {submitLabel}
        </Button>
        {extra}
      </Flex>
    </Flex>
  );
}
