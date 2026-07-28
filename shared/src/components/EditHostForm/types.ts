import type { Host } from "bridge/data";
import type { UseFormReturn } from "react-hook-form";

export type JumpHostsFormFields = {
  jumpHostEnabled?: boolean;
  jumpHostIds?: string[];
};

export type EditHostFormFields = Omit<Partial<Host>, "envs" | "jumpHostIds"> &
  JumpHostsFormFields & {
    envs?: string;
  };

export type EditHostFormApi = UseFormReturn<EditHostFormFields>;
