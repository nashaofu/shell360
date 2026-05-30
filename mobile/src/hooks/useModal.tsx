import { useMemo } from "react";
import { modal as sharedModal } from "shared";

export default function useModal() {
  return useMemo(
    () => ({
      info: sharedModal.info,
      success: sharedModal.success,
      error: sharedModal.error,
      warning: sharedModal.warning,
      confirm: sharedModal.confirm,
    }),
    [],
  );
}
