export interface NativeRuntime {
  invoke(method: string, clientId: string, paramsJson: string): Promise<string>;
  sendSshShellData(clientId: string, sshShellId: string, data: ArrayBuffer): Promise<void>;
  onSshShellData?(handler: (event: SshShellDataEvent) => void): void;
  releaseClient(clientId: string): Promise<void>;
  onEvent?(handler: (event: string) => void): void;
}

export interface SshShellDataEvent {
  clientId: string;
  sshShellId: string;
  data: number[];
}
