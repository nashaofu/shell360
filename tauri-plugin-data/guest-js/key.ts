import { invoke } from '@tauri-apps/api/core';

export interface Key {
  id: string;
  name: string;
  privateKey: string;
  publicKey: string;
  passphrase?: string;
}

export async function getKeys(): Promise<Key[]> {
  return invoke<Key[]>('plugin:data|get_keys');
}

export function addKey(key: Omit<Key, 'id'>): Promise<Key> {
  return invoke<Key>('plugin:data|add_key', { key });
}

export function updateKey(key: Key): Promise<Key> {
  return invoke<Key>('plugin:data|update_key', { key });
}

export function deleteKey(key: Key): Promise<null> {
  return invoke<null>('plugin:data|delete_key', {
    key,
  });
}
