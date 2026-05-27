import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authAtom } from "@/atoms/auth";
import { cryptoIsEnableAtom } from "@/atoms/crypto";
import GuardLoading from "./GuardLoading";

type RequireUnlockProps = {
  children: ReactNode;
};

export default function RequireUnlock({ children }: RequireUnlockProps) {
  const isAuthed = useAtomValue(authAtom);
  const cryptoIsEnable = useAtomValue(cryptoIsEnableAtom);
  const location = useLocation();

  if (cryptoIsEnable === undefined || isAuthed === undefined) {
    return <GuardLoading />;
  }

  if (!cryptoIsEnable || isAuthed) {
    return children;
  }

  return <Navigate to="/unlock" replace state={{ from: location }} />;
}
