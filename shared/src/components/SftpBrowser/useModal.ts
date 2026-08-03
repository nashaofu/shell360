import { modal as sharedModal } from "@/components/Modal";

export default function useModal() {
  return {
    info: sharedModal.info,
    success: sharedModal.success,
    error: sharedModal.error,
    warning: sharedModal.warning,
    confirm: sharedModal.confirm,
  };
}
