import { v4 as uuid } from "uuid";

export interface JsbTransport {
  send(message: string): void;
  setMessageHandler(handler: ((message: string) => void) | null): void;
}

export type JsbEventListener<T = unknown> = (
  payload: T,
  meta?: { event: string; targetId?: string },
) => void;

export class JsbError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "JsbError";
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: JsbError) => void;
};

type QueuedRequest = {
  message: string;
  pending: PendingRequest;
};

const MAX_QUEUE_SIZE = 128;

class JsbClient {
  private clientId = `jsb-${uuid()}`;
  private transport: JsbTransport | undefined;
  private connected = false;
  private disposed = false;
  private readonly queue: QueuedRequest[] = [];
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<string, Set<JsbEventListener>>();
  invoke<TParams = void, TResult = void>(
    method: string,
    params?: TParams,
  ): Promise<TResult> {
    if (this.disposed) {
      return Promise.reject(
        new JsbError("JSB_DISPOSED", "JSB has been disposed."),
      );
    }
    const id = uuid();
    const message = JSON.stringify({
      type: "invoke",
      id,
      clientId: this.clientId,
      method,
      params: params ?? null,
    });
    return new Promise<TResult>((resolve, reject) => {
      const pending: PendingRequest = {
        resolve: (value) => resolve(value as TResult),
        reject,
      };
      this.pending.set(id, pending);
      if (!this.connected) {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
          this.pending.delete(id);
          reject(new JsbError("JSB_QUEUE_FULL", "JSB request queue is full."));
          return;
        }
        this.queue.push({ message, pending });
        return;
      }
      this.send(message);
    });
  }

  on<TPayload = unknown>(
    event: string,
    listener: JsbEventListener<TPayload>,
  ): () => void {
    const listeners = this.listeners.get(event) ?? new Set<JsbEventListener>();
    const callback = listener as JsbEventListener;
    listeners.add(callback);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) this.listeners.delete(event);
    };
  }

  attachTransport(transport: JsbTransport): void {
    if (this.disposed)
      throw new JsbError("JSB_DISPOSED", "JSB has been disposed.");
    this.transport?.setMessageHandler(null);
    this.transport = transport;
    transport.setMessageHandler((message) => this.handleMessage(message));
    this.connected = true;
    while (this.queue.length > 0) {
      const queued = this.queue.shift();
      if (queued) this.send(queued.message);
    }
  }

  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.connected = false;
    this.transport?.setMessageHandler(null);
    const error = new JsbError("JSB_DISPOSED", "JSB has been disposed.");
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
    this.queue.length = 0;
    this.listeners.clear();
  }

  private send(message: string): void {
    try {
      this.transport?.send(message);
    } catch (error) {
      this.handleSendFailure(message, error);
    }
  }

  private handleSendFailure(message: string, error: unknown): void {
    const parsed = JSON.parse(message) as { id: string };
    const pending = this.pending.get(parsed.id);
    if (!pending) return;
    this.pending.delete(parsed.id);
    pending.reject(
      new JsbError(
        "JSB_TRANSPORT_ERROR",
        error instanceof Error ? error.message : "JSB transport failed.",
      ),
    );
  }

  private handleMessage(message: string): void {
    let parsed: {
      type?: string;
      id?: string;
      result?: unknown;
      error?: { code?: string; message?: string; details?: unknown };
      event?: string;
      targetId?: string;
      payload?: unknown;
    };
    try {
      parsed = JSON.parse(message) as typeof parsed;
    } catch {
      return;
    }
    if ((parsed.type === "emit" || parsed.event) && parsed.event) {
      for (const listener of this.listeners.get(parsed.event) ?? []) {
        listener(parsed.payload, {
          event: parsed.event,
          targetId: parsed.targetId,
        });
      }
      return;
    }
    if (parsed.type !== "result" || !parsed.id) return;
    const pending = this.pending.get(parsed.id);
    if (!pending) return;
    this.pending.delete(parsed.id);
    if (parsed.error) {
      pending.reject(
        new JsbError(
          parsed.error.code ?? "JSB_NATIVE_ERROR",
          parsed.error.message ?? "Native invocation failed.",
          parsed.error.details,
        ),
      );
    } else {
      pending.resolve(parsed.result);
    }
  }
}

const jsb = new JsbClient();

export function attachTransport(
  transport: JsbTransport,
  clientId?: string,
): void {
  if (clientId) jsb.setClientId(clientId);
  jsb.attachTransport(transport);
}

export default jsb;
