import EventEmitter from "eventemitter3";
import { v4 as uuid } from "uuid";
import { JSBError, toJSBError } from "./error";
import { JSBChannel } from "./jsb_channel";
import { parseIncomingMessage, serializeInvokeRequest } from "./protocol";
import type {
  JSBEmitMessage,
  JSBEventListener,
  JSBEventMeta,
  JSBInvokeRequest,
  JSBInvokeResponse,
} from "./types";

type PendingRequest = {
  reject(error: JSBError): void;
  resolve(value: unknown): void;
};

class JSB {
  private readonly channel = new JSBChannel<string>();
  private readonly events = new EventEmitter<string>();
  private readonly pendingRequests = new Map<string, PendingRequest>();

  constructor() {
    this.channel.on("message", this.handleMessage);
    this.channel.on("error", this.rejectPendingRequests);
    this.channel.on("close", this.handleChannelClose);
  }

  invoke<TRequest = void, TResponse = void>(
    method: string,
    data?: TRequest,
  ): Promise<TResponse> {
    if (method.length === 0) {
      return Promise.reject(
        new JSBError("JSB_INVALID_METHOD", "JSB method must not be empty."),
      );
    }

    return new Promise<TResponse>((resolve, reject) => {
      const id = uuid();
      const request: JSBInvokeRequest<TRequest> = {
        type: "invoke.request",
        id,
        method,
        data,
      };

      let message: string;
      try {
        message = serializeInvokeRequest(request);
      } catch (error) {
        reject(
          toJSBError(
            error,
            "JSB_SERIALIZATION_ERROR",
            "Could not serialize JSB request.",
          ),
        );
        return;
      }

      this.pendingRequests.set(id, {
        reject,
        resolve: (value) => resolve(value as TResponse),
      });

      try {
        this.channel.postMessage(message);
      } catch (error) {
        const pending = this.takePendingRequest(id);
        pending?.reject(
          toJSBError(
            error,
            "JSB_TRANSPORT_ERROR",
            "Could not send JSB request.",
          ),
        );
      }
    });
  }

  on<TPayload = unknown>(
    event: string,
    listener: JSBEventListener<TPayload>,
  ): void {
    this.events.on(event, listener);
  }

  once<TPayload = unknown>(
    event: string,
    listener: JSBEventListener<TPayload>,
  ): void {
    this.events.once(event, listener);
  }

  off<TPayload = unknown>(
    event: string,
    listener: JSBEventListener<TPayload>,
  ): void {
    this.events.off(event, listener);
  }

  private readonly handleMessage = (message: string): void => {
    const incoming = parseIncomingMessage(message);
    if (!incoming) {
      this.rejectPendingRequests(
        new JSBError(
          "JSB_INVALID_RESPONSE",
          "The native bridge returned an invalid JSB message.",
        ),
      );
      return;
    }

    if (incoming.type === "emit") {
      this.emitEvent(incoming);
      return;
    }
    this.resolveInvocation(incoming);
  };

  private emitEvent(message: JSBEmitMessage): void {
    const meta: JSBEventMeta = {
      event: message.event,
      ...(message.targetId === undefined ? {} : { targetId: message.targetId }),
      ...(message.clientId === undefined ? {} : { clientId: message.clientId }),
      ...(message.sequence === undefined ? {} : { sequence: message.sequence }),
    };
    this.events.emit(message.event, message.payload, meta);
  }

  private resolveInvocation(response: JSBInvokeResponse): void {
    const pending = this.takePendingRequest(response.id);
    if (!pending) {
      return;
    }

    if ("error" in response) {
      pending.reject(
        new JSBError(
          response.error.code ?? "JSB_NATIVE_ERROR",
          response.error.message ?? "JSB invocation failed.",
          response.error.details,
        ),
      );
      return;
    }
    pending.resolve(response.data);
  }

  private takePendingRequest(id: string): PendingRequest | undefined {
    const pending = this.pendingRequests.get(id);
    this.pendingRequests.delete(id);
    return pending;
  }

  private readonly rejectPendingRequests = (error: JSBError): void => {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  };

  private readonly handleChannelClose = (): void => {
    this.rejectPendingRequests(
      new JSBError("JSB_CHANNEL_CLOSED", "JSB channel is closed."),
    );
  };
}

const jsb = new JSB();

export default jsb;
