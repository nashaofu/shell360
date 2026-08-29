export interface NativeRuntime {
  invoke(method: string, clientId: string, paramsJson: string): Promise<string>;
  releaseClient(clientId: string): Promise<void>;
  onEvent?(handler: (event: string) => void): void;
}
