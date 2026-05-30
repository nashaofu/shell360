import { useMemo } from "react";
import { modal as sharedModal } from "shared";

/**
 * Hook wrapper around the static `modal` API.
 * Returns the same `{ info, success, error, warning, confirm }` shape so
 * existing callers don't need to change their usage.
 */
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
