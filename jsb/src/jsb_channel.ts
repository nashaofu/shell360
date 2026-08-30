import EventEmitter from "eventemitter3";
import { v4 as uuid } from "uuid";
import {
  cancelNativeChannelRequest,
  closeNativeChannel,
  closePorts,
  requestNativeChannel,
} from "./channel_registry";
import { JSBError, toJSBError } from "./error";

export type JSBChannelMessage = string | ArrayBuffer;

type JSBChannelEvents<TMessage extends JSBChannelMessage> = {
  close: () => void;
  error: (error: JSBError) => void;
  message: (message: TMessage) => void;
  open: () => void;
};

type JSBChannelState = "closed" | "failed" | "open" | "opening";

export class JSBChannel<
  TMessage extends JSBChannelMessage = JSBChannelMessage,
> {
  readonly channelId = uuid();

  private readonly events = new EventEmitter<string>();
  private readonly queue: TMessage[] = [];
  private port?: MessagePort;
  private state: JSBChannelState = "opening";

  constructor() {
    const error = requestNativeChannel(this.channelId, {
      attach: this.attachPort,
      fail: this.fail,
    });
    if (error) {
      // Allow callers to subscribe before reporting a synchronous bootstrap error.
      queueMicrotask(() => this.fail(error));
    }
  }

  postMessage(message: TMessage): void {
    if (this.state === "opening") {
      this.queue.push(message);
      return;
    }
    if (this.state !== "open" || !this.port) {
      throw new JSBError(
        "JSB_CHANNEL_CLOSED",
        "Cannot send a message through a closed JSB channel.",
      );
    }

    this.send(this.port, message);
  }

  close(): void {
    if (this.state === "closed" || this.state === "failed") {
      return;
    }

    this.state = "closed";
    this.releaseResources();

    const error = closeNativeChannel(this.channelId);
    if (error) {
      this.events.emit("error", error);
    }
    this.events.emit("close");
    this.events.removeAllListeners();
  }

  on<K extends keyof JSBChannelEvents<TMessage>>(
    event: K,
    listener: JSBChannelEvents<TMessage>[K],
  ): void {
    this.events.on(event, listener);
  }

  once<K extends keyof JSBChannelEvents<TMessage>>(
    event: K,
    listener: JSBChannelEvents<TMessage>[K],
  ): void {
    this.events.once(event, listener);
  }

  off<K extends keyof JSBChannelEvents<TMessage>>(
    event: K,
    listener: JSBChannelEvents<TMessage>[K],
  ): void {
    this.events.off(event, listener);
  }

  private readonly attachPort = (port: MessagePort): void => {
    if (this.state !== "opening") {
      closePorts([port]);
      return;
    }

    try {
      this.port = port;
      port.addEventListener("message", this.handleMessage);
      port.addEventListener("messageerror", this.handleMessageError);
      port.start();
      this.state = "open";
    } catch (error) {
      this.fail(
        toJSBError(
          error,
          "JSB_CHANNEL_OPEN_FAILED",
          "Could not start JSB channel.",
        ),
      );
      return;
    }

    for (const message of this.queue.splice(0)) {
      try {
        this.send(port, message);
      } catch {
        return;
      }
    }
    this.events.emit("open");
  };

  private readonly fail = (error: JSBError): void => {
    if (this.state === "closed" || this.state === "failed") {
      return;
    }

    this.state = "failed";
    this.releaseResources();
    closeNativeChannel(this.channelId);
    this.events.emit("error", error);
    this.events.emit("close");
    this.events.removeAllListeners();
  };

  private readonly handleMessage = (event: MessageEvent<unknown>): void => {
    console.log("channel-message", event);
    this.events.emit("message", event.data as TMessage);
  };

  private readonly handleMessageError = (): void => {
    this.events.emit(
      "error",
      new JSBError(
        "JSB_CHANNEL_MESSAGE_ERROR",
        "The JSB channel received an unreadable message.",
      ),
    );
  };

  private send(port: MessagePort, message: TMessage): void {
    try {
      port.postMessage(message);
    } catch (error) {
      const transportError = toJSBError(
        error,
        "JSB_CHANNEL_TRANSPORT_ERROR",
        "Could not send a JSB channel message.",
      );
      this.fail(transportError);
      throw transportError;
    }
  }

  private releaseResources(): void {
    cancelNativeChannelRequest(this.channelId);
    this.queue.length = 0;

    const port = this.port;
    this.port = undefined;
    if (!port) {
      return;
    }

    port.removeEventListener("message", this.handleMessage);
    port.removeEventListener("messageerror", this.handleMessageError);
    closePorts([port]);
  }
}
