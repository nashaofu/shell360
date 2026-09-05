export interface JSBInvokeRequest<TRequest = unknown> {
  readonly type: "invoke.request";
  readonly id: string;
  readonly method: string;
  readonly data?: TRequest;
}

export interface JSBInvokeResponseSuccess<TResponse = unknown> {
  readonly type: "invoke.response";
  readonly id: string;
  readonly data: TResponse;
}

export interface JSBErrorPayload {
  readonly code?: string;
  readonly message?: string;
  readonly details?: unknown;
}

export interface JSBInvokeResponseError {
  readonly type: "invoke.response";
  readonly id: string;
  readonly error: JSBErrorPayload;
}

export type JSBInvokeResponse<TResponse = unknown> =
  | JSBInvokeResponseSuccess<TResponse>
  | JSBInvokeResponseError;

export interface JSBEmitMessage<TPayload = unknown> {
  readonly type: "emit";
  readonly event: string;
  readonly targetId?: string;
  readonly payload?: TPayload;
  readonly clientId?: string;
  readonly sequence?: number;
}

export type JSBIncomingMessage = JSBInvokeResponse | JSBEmitMessage;

export interface JSBEventMeta {
  readonly event: string;
  readonly targetId?: string;
  readonly clientId?: string;
  readonly sequence?: number;
}

export type JSBEventListener<T = unknown> = (
  payload: T,
  meta: JSBEventMeta,
) => void;

export interface JSBNativeBridge {
  openChannel(channelId: string): void;
  closeChannel(channelId: string): void;
}

declare global {
  interface Window {
    __JSB__?: JSBNativeBridge;
  }
}
