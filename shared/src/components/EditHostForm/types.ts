import type { UseFormReturn } from 'react-hook-form';
import type { Host } from 'tauri-plugin-data';

export type JumpHostsFormFields = {
  jumpHostEnabled?: boolean;
  jumpHostIds?: string[];
};

export type EditHostFormFields = Partial<Host> & JumpHostsFormFields;

export type EditHostFormApi = UseFormReturn<EditHostFormFields>;
