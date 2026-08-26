export interface JSBInvokeRequestMessage<TRequest = unknown> {
  type: "invoke.request";
  id: string;
  method: string;
  data?: TRequest;
}

export interface JSBInvokeResponseMessageSuccess<TResponse = unknown> {
  type: "invoke.response";
  id: string;
  data: TResponse;
}

export interface JSBErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

export interface JSBInvokeResponseMessageError {
  type: "invoke.response";
  id: string;
  error: JSBErrorPayload;
}

export type JSBInvokeResponseMessage<TResponse = unknown> =
  | JSBInvokeResponseMessageSuccess<TResponse>
  | JSBInvokeResponseMessageError;

export interface JSBEmitMessage<TPayload = unknown> {
  type: "emit";
  event: string;
  targetId?: string;
  payload?: TPayload;
  clientId?: string;
  sequence?: number;
}

export type JSBIncomingMessage = JSBInvokeResponseMessage | JSBEmitMessage;

export interface JSBEventMeta {
  event: string;
  targetId?: string;
}

export type JSBEventListener<T = unknown> = (
  payload: T,
  meta: JSBEventMeta,
) => void;

export type JSBPortMessageEvent = { data: unknown };

export type JSBPortMessageListener = (event: JSBPortMessageEvent) => void;

export interface JSBPort {
  postMessage(message: string): void;
  addEventListener(type: "message", listener: JSBPortMessageListener): void;
  removeEventListener(type: "message", listener: JSBPortMessageListener): void;
}

export type JSBGlobal = {
  port: Promise<JSBPort>;
  receive?: (message: string) => void;
};

declare global {
  interface Window {
    __JSB__?: JSBGlobal;
  }
}
