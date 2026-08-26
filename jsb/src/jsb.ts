import EventEmitter from "eventemitter3";
import { v4 as uuid } from "uuid";
import { JSBError } from "./error";
import type {
  JSBEventListener,
  JSBEventMeta,
  JSBIncomingMessage,
  JSBInvokeRequestMessage,
  JSBPort,
  JSBPortMessageEvent,
} from "./types";

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: JSBError): void;
};
type QueuedRequest = { id: string; message: string };
type JSBEvents = Record<string, JSBEventListener>;

const MAX_QUEUE_SIZE = 256;

export class JSB {
  private port: JSBPort | undefined;
  private readonly queue: QueuedRequest[] = [];
  private readonly pending = new Map<string, PendingRequest>();
  private readonly events = new EventEmitter<JSBEvents>();

  constructor() {
    if (!window.__JSB__) {
      throw new JSBError(
        "JSB_NOT_INITIALIZED",
        "window.__JSB__ must be injected before JSB is initialized.",
      );
    }
    window.__JSB__.port.then((port) => {
      this.port = port;
      this.port.addEventListener("message", (event) => {
        this.onMessage(event);
      });

      while (this.queue.length > 0) {
        const queued = this.queue.shift();
        if (queued) {
          this.postMessage(queued.id, queued.message);
        }
      }
    });
  }

  invoke<TRequest = void, TResponse = void>(
    method: string,
    data?: TRequest,
  ): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        reject(new JSBError("JSB_QUEUE_FULL", "JSB request queue is full."));
        return;
      }

      const id = uuid();
      const request: JSBInvokeRequestMessage<TRequest> = {
        type: "invoke.request",
        id,
        method,
        data,
      };
      const message = JSON.stringify(request);

      this.pending.set(id, {
        resolve: (value) => resolve(value as TResponse),
        reject,
      });
      if (!this.port) {
        this.queue.push({ id, message });
        return;
      }
      this.postMessage(id, message);
    });
  }

  on<TPayload = unknown>(event: string, listener: JSBEventListener<TPayload>) {
    const callback = listener as JSBEventListener;
    this.events.on(event, callback);
  }

  once<TPayload = unknown>(
    event: string,
    listener: JSBEventListener<TPayload>,
  ) {
    const callback = listener as JSBEventListener;
    this.events.once(event, callback);
  }

  off<TPayload = unknown>(
    event: string,
    listener: JSBEventListener<TPayload>,
  ): void {
    const callback = listener as JSBEventListener;
    this.events.off(event, callback);
  }

  private postMessage(id: string, message: string): void {
    try {
      this.port?.postMessage(message);
    } catch (error) {
      const pending = this.pending.get(id);
      this.pending.delete(id);
      if (!pending) {
        return;
      }
      pending.reject(
        new JSBError(
          "JSB_TRANSPORT_ERROR",
          error instanceof Error ? error.message : "JSB port failed.",
        ),
      );
    }
  }

  private onMessage(event: JSBPortMessageEvent): void {
    console.log("Received message:", event);

    const parsed = JSON.parse(event.data as string) as JSBIncomingMessage;

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    if (parsed.type === "emit") {
      const meta: JSBEventMeta = {
        event: parsed.event,
        ...(parsed.targetId ? { targetId: parsed.targetId } : {}),
      };
      this.events.emit(parsed.event, parsed.payload, meta);
      return;
    } else if (parsed.type === "invoke.response") {
      const pending = this.pending.get(parsed.id);
      this.pending.delete(parsed.id);
      if (!pending) {
        return;
      }

      if ("error" in parsed) {
        pending.reject(
          new JSBError(
            parsed.error.code ?? "JSB_NATIVE_ERROR",
            parsed.error.message ?? "JSB invocation failed.",
            parsed.error.details,
          ),
        );
        return;
      }

      pending.resolve(parsed.data);
    }
  }
}
