import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

export async function checkIsEnableCrypto(): Promise<boolean> {
  return invoke<boolean>('plugin:data|check_is_enable_crypto');
}

export async function checkIsInitCrypto(): Promise<boolean> {
  return invoke<boolean>('plugin:data|check_is_init_crypto');
}

export async function checkIsAuthed(): Promise<boolean> {
  return invoke<boolean>('plugin:data|check_is_authed');
}

export async function onAuthedChange(
  callback: (isAuthed: boolean) => unknown
): Promise<UnlistenFn> {
  const unListen = await listen<boolean>('data://authed_change', (event) => {
    callback(event.payload);
  });

  return unListen;
}

export async function initCryptoKey(): Promise<void> {
  return invoke<void>('plugin:data|init_crypto_key');
}

export interface InitCryptoPasswordOpts extends Record<string, unknown> {
  password: string;
  confirmPassword: string;
}

export async function initCryptoPassword(
  opts: InitCryptoPasswordOpts
): Promise<void> {
  return invoke<void>('plugin:data|init_crypto_password', opts);
}

export interface LoadCryptoByPasswordOpts extends Record<string, unknown> {
  password: string;
}

export async function loadCryptoByPassword(
  opts: LoadCryptoByPasswordOpts
): Promise<void> {
  return invoke<void>('plugin:data|load_crypto_by_password', opts);
}

export interface ChangeCryptoPasswordOpts extends Record<string, unknown> {
  oldPassword: string;
  password: string;
  confirmPassword: string;
}

export async function changeCryptoPassword(
  opts: ChangeCryptoPasswordOpts
): Promise<void> {
  return invoke<void>('plugin:data|change_crypto_password', opts);
}

export async function initCryptoBiometric(): Promise<void> {
  return invoke<void>('plugin:data|init_crypto_biometric');
}

export async function loadCryptoByBiometric(): Promise<void> {
  return invoke<void>('plugin:data|load_crypto_by_biometric');
}

export interface ChangeCryptoEnableOpts extends Record<string, unknown> {
  cryptoEnable: boolean;
  password?: string;
  confirmPassword?: string;
}

export async function changeCryptoEnable(
  opts: ChangeCryptoEnableOpts
): Promise<void> {
  return invoke<void>('plugin:data|change_crypto_enable', opts);
}

export async function resetCrypto(): Promise<void> {
  return invoke<void>('plugin:data|reset_crypto');
}

export async function rotateCryptoKey(password: string): Promise<void> {
  return invoke<void>('plugin:data|rotate_crypto_key', { password });
}
