import { type ReactNode, useMemo } from "react";
import { message as sharedMessage } from "shared";

type NotistackCompatArg = { message: ReactNode };

function normalizeArg(arg: ReactNode | NotistackCompatArg): ReactNode {
  return typeof arg === "object" && arg !== null && "message" in arg
    ? (arg as NotistackCompatArg).message
    : (arg as ReactNode);
}

export default function useMessage() {
  return useMemo(
    () => ({
      success: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.success(normalizeArg(arg)),
      error: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.error(normalizeArg(arg)),
      info: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.info(normalizeArg(arg)),
      warning: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.warning(normalizeArg(arg)),
    }),
    [],
  );
}
