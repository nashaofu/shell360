export interface JsbTransport {
  send(message: string): void;
  setMessageHandler(handler: ((message: string) => void) | null): void;
}
export type JsbEventListener<T = unknown> = (
  payload: T,
  meta?: {
    event: string;
    targetId?: string;
  },
) => void;
export declare class JsbError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, details?: unknown);
}
declare class JsbClient {
  private clientId;
  private transport;
  private connected;
  private disposed;
  private readonly queue;
  private readonly pending;
  private readonly listeners;
  private sequence;
  invoke<TParams = void, TResult = void>(
    method: string,
    params?: TParams,
  ): Promise<TResult>;
  on<TPayload = unknown>(
    event: string,
    listener: JsbEventListener<TPayload>,
  ): () => void;
  attachTransport(transport: JsbTransport): void;
  setClientId(clientId: string): void;
  dispose(): void;
  private send;
  private handleSendFailure;
  private handleMessage;
}
declare const jsb: JsbClient;
export declare function attachTransport(
  transport: JsbTransport,
  clientId?: string,
): void;
export default jsb;
