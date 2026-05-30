import type { ReactNode } from "react";
import { useMemo } from "react";
import { message as sharedMessage } from "shared";

type NotistackCompatArg = { message: ReactNode };

export default function useMessage() {
  return useMemo(
    () => ({
      success: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.success(
          typeof arg === "object" && arg !== null && "message" in arg
            ? (arg as NotistackCompatArg).message
            : (arg as ReactNode),
        ),
      error: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.error(
          typeof arg === "object" && arg !== null && "message" in arg
            ? (arg as NotistackCompatArg).message
            : (arg as ReactNode),
        ),
      info: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.info(
          typeof arg === "object" && arg !== null && "message" in arg
            ? (arg as NotistackCompatArg).message
            : (arg as ReactNode),
        ),
      warning: (arg: ReactNode | NotistackCompatArg) =>
        sharedMessage.warning(
          typeof arg === "object" && arg !== null && "message" in arg
            ? (arg as NotistackCompatArg).message
            : (arg as ReactNode),
        ),
    }),
    [],
  );
}
