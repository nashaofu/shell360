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
  /**
   * 完整链路（强顺序链），jumpHostIds 中的主机必须按顺序连接
   * 不会递归解析链路中的 host 的 jumpHostIds
   * 递归解析会导致如下问题：
   * 1. 配置一个 host 的跳板会影响另一个 host 的访问路径。
   * 2. 用户难以理解真实链路。
   * 3. 容易出现环形依赖。
   * 4. 很难做错误提示，因为用户不知道哪些节点被隐式引用。
   * 例如如下数据结构，如果递归解析的话，访问链路为 0 → 1 → 4 → 2 → 3 → 5，4 → 2 会被建立隐藏的引用关系，导致配置维护难度大，链路不直观。
   * [
   *   {
   *     id: '0',
   *     jumpHostIds: []
   *   },
   *   {
   *     id: '1',
   *     jumpHostIds: ['0']
   *   },
   *   {
   *     id: '2',
   *     jumpHostIds: []
   *   },
   *   {
   *     id: '3',
   *     jumpHostIds: ['2']
   *   },
   *   {
   *     id: '4',
   *     jumpHostIds: ['1']
   *   },
   *   {
   *     id: '5',
   *     jumpHostIds: ['4', '3']
   *   }
   * ]
   */
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
