import { invoke } from '@tauri-apps/api/core';

import type { IapOffering } from './iap/iapOffering';
import type { IapCustomerInfo } from './iap/iapCustomerInfo';

export * from './iap/iapOffering';
export * from './iap/iapCustomerInfo';

export async function iapGetCustomerInfo(): Promise<IapCustomerInfo> {
  return invoke('plugin:mobile|iap_get_customer_info');
}

export async function iapGetOfferings(): Promise<IapOffering[]> {
  return invoke('plugin:mobile|iap_get_offerings');
}

export type IapPurchasePackageRequest = {
  packageIdentifier: string;
};

export async function iapPurchasePackage(
  opts: IapPurchasePackageRequest
): Promise<IapCustomerInfo> {
  return invoke('plugin:mobile|iap_purchase_package', opts);
}

export async function iapRestore(): Promise<IapCustomerInfo> {
  return invoke('plugin:mobile|iap_restore');
}

export async function iapShowPaywall(): Promise<boolean> {
  return invoke('plugin:mobile|iap_show_paywall');
}

export type ExportTextFileRequest = {
  filename: string;
  data: string;
};

export type ExportTextFileResponse = {
  cancel: boolean;
};

export async function exportTextFile(
  opts: ExportTextFileRequest
): Promise<ExportTextFileResponse> {
  return invoke('plugin:mobile|export_text_file', opts);
}

export type ImportTextFileResponse = {
  cancel: boolean;
  data?: string;
};

export async function importTextFile(): Promise<ImportTextFileResponse> {
  return invoke('plugin:mobile|import_text_file');
}
