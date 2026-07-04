import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authAtom } from "@/atoms/auth.atom";
import { cryptoIsEnableAtom } from "@/atoms/crypto.atom";
import GuardLoading from "./GuardLoading";

type RequireLockedProps = {
  children: ReactNode;
};

export default function RequireLocked({ children }: RequireLockedProps) {
  const isAuthed = useAtomValue(authAtom);
  const cryptoIsEnable = useAtomValue(cryptoIsEnableAtom);
  const location = useLocation();

  if (cryptoIsEnable === undefined || isAuthed === undefined) {
    return <GuardLoading />;
  }

  if (cryptoIsEnable && !isAuthed) {
    return children;
  }

  const from =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "object" &&
    location.state.from &&
    "pathname" in location.state.from &&
    typeof location.state.from.pathname === "string"
      ? location.state.from.pathname
      : "/";

  return <Navigate to={from} replace />;
}
