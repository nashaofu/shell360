import { get } from "lodash-es";
import { type ReactNode, useCallback } from "react";
import useMessage from "./useMessage";
import useModal from "./useModal";

type ConfirmDeleteOptions = {
  content: ReactNode;
  failureMessage?: string;
  onDelete: () => Promise<unknown>;
  onSuccess?: () => Promise<unknown> | unknown;
  title?: string;
};

export function useConfirmDelete() {
  const modal = useModal();
  const message = useMessage();

  return useCallback(
    ({
      content,
      failureMessage = "Deletion failed",
      onDelete,
      onSuccess,
      title = "Delete Confirmation",
    }: ConfirmDeleteOptions) => {
      modal.confirm({
        title,
        content,
        OkButtonProps: { color: "orange" },
        onOk: async () => {
          try {
            await onDelete();
            await onSuccess?.();
          } catch (err) {
            message.error({
              message: get(err, "message") || failureMessage,
            });
            throw err;
          }
        },
      });
    },
    [message, modal],
  );
}
