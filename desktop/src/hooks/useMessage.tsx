import { type ReactNode, useMemo } from "react";
import { message as sharedMessage } from "shared";

type MessageArg = { message: ReactNode };

export default function useMessage() {
  return useMemo(
    () => ({
      success: (arg: MessageArg) => sharedMessage.success(arg.message),
      error: (arg: MessageArg) => sharedMessage.error(arg.message),
      info: (arg: MessageArg) => sharedMessage.info(arg.message),
      warning: (arg: MessageArg) => sharedMessage.warning(arg.message),
    }),
    [],
  );
}
