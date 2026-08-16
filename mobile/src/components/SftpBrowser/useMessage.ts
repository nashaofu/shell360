import type { ReactNode } from "react";
import { useMemo } from "react";
import { message as sharedMessage } from "shared";

type MessageArg = { message: ReactNode };

export default function useMessage() {
  return useMemo(
    () => ({
      success: (arg: MessageArg | ReactNode) =>
        sharedMessage.success(normalize(arg)),
      error: (arg: MessageArg | ReactNode) =>
        sharedMessage.error(normalize(arg)),
      info: (arg: MessageArg | ReactNode) => sharedMessage.info(normalize(arg)),
      warning: (arg: MessageArg | ReactNode) =>
        sharedMessage.warning(normalize(arg)),
    }),
    [],
  );
}

function normalize(arg: MessageArg | ReactNode): ReactNode {
  if (arg && typeof arg === "object" && "message" in arg) {
    return (arg as MessageArg).message;
  }
  return arg as ReactNode;
}
