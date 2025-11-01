import { invoke } from '@tauri-apps/api/core';

export interface HostTerminalSettings {
  fontFamily?: string;
  fontSize?: number;
  theme?: string;
}

export enum AuthenticationMethod {
  Password = 'Password',
  PublicKey = 'PublicKey',
  Certificate = 'Certificate',
}

export interface Env {
  key: string;
  value: string;
}

export interface Host {
  id: string;
  name?: string;
  tags?: string[];
  hostname: string;
  port: number;
  username: string;
  authenticationMethod: AuthenticationMethod;
  password?: string;
  keyId?: string;
  startupCommand?: string;
  terminalType?: string;
  envs?: Env[];
  jumpHostIds?: string[];
  terminalSettings?: HostTerminalSettings;
}

export async function getHosts(): Promise<Host[]> {
  return invoke<Host[]>('plugin:data|get_hosts');
}

export function addHost(host: Omit<Host, 'id'>): Promise<Host> {
  return invoke<Host>('plugin:data|add_host', { host });
}

export function updateHost(host: Host): Promise<Host> {
  return invoke<Host>('plugin:data|update_host', { host });
}

export function deleteHost(host: Host): Promise<null> {
  return invoke<null>('plugin:data|delete_host', {
    host,
  });
}
