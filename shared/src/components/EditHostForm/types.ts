import type { UseFormReturn } from 'react-hook-form';
import type { Host } from 'tauri-plugin-data';

export type JumpHostsFormFields = {
  jumpHostEnabled?: boolean;
  jumpHostIds?: string[];
};

export type EditHostFormFields = Omit<Partial<Host>, 'envs' | 'jumpHostIds'> &
  JumpHostsFormFields & {
    envs?: string;
  };

export type EditHostFormApi = UseFormReturn<EditHostFormFields>;
