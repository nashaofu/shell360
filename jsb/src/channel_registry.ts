import { JSBError, toJSBError } from "./error";
import { isRecord } from "./protocol";
import type { JSBErrorPayload } from "./types";

type PendingChannel = {
  attach(port: MessagePort): void;
  fail(error: JSBError): void;
};

type ChannelControlMessage = {
  channelId: string;
  error?: JSBErrorPayload;
  source: "shell360.jsb";
  type: "channel.open.failed" | "channel.opened";
};

const CONTROL_MESSAGE_SOURCE = "shell360.jsb";
const pendingChannels = new Map<string, PendingChannel>();

function parseControlError(value: unknown): JSBErrorPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    (value.code != null && typeof value.code !== "string") ||
    (value.message != null && typeof value.message !== "string")
  ) {
    return undefined;
  }

  return {
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.message === "string" ? { message: value.message } : {}),
    ...(value.details === undefined ? {} : { details: value.details }),
  };
}

function parseControlMessage(
  value: unknown,
): ChannelControlMessage | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const message: unknown = JSON.parse(value);
    if (
      !isRecord(message) ||
      message.source !== CONTROL_MESSAGE_SOURCE ||
      typeof message.channelId !== "string" ||
      (message.type !== "channel.opened" &&
        message.type !== "channel.open.failed")
    ) {
      return undefined;
    }

    const error =
      message.error === undefined
        ? undefined
        : parseControlError(message.error);
    if (message.error !== undefined && !error) {
      return undefined;
    }

    return {
      channelId: message.channelId,
      source: CONTROL_MESSAGE_SOURCE,
      type: message.type,
      ...(error ? { error } : {}),
    };
  } catch {
    return undefined;
  }
}

export function closePorts(ports: readonly MessagePort[]): void {
  for (const port of ports) {
    try {
      port.close();
    } catch {
      // Continue releasing the remaining native resources.
    }
  }
}

function handleControlMessage(event: MessageEvent<unknown>): void {
  console.log("window-message", event);
  const isSameWindowMessage =
    event.source === window && event.origin === window.location.origin;
  const isNativeWebViewMessage =
    event.source === null &&
    (event.origin === "" || event.origin === window.location.origin);
  if (!isSameWindowMessage && !isNativeWebViewMessage) {
    return;
  }

  const message = parseControlMessage(event.data);
  if (!message) {
    return;
  }

  const pending = pendingChannels.get(message.channelId);
  if (!pending) {
    closePorts(event.ports);
    return;
  }

  pendingChannels.delete(message.channelId);
  if (message.type === "channel.open.failed") {
    closePorts(event.ports);
    pending.fail(
      new JSBError(
        message.error?.code ?? "JSB_CHANNEL_OPEN_FAILED",
        message.error?.message ?? "Could not open JSB channel.",
        message.error?.details,
      ),
    );
    return;
  }

  if (event.ports.length !== 1) {
    closePorts(event.ports);
    pending.fail(
      new JSBError(
        "JSB_CHANNEL_OPEN_FAILED",
        "The native bridge did not provide exactly one message port.",
      ),
    );
    return;
  }

  pending.attach(event.ports[0]);
}

window.addEventListener("message", handleControlMessage);

export function requestNativeChannel(
  channelId: string,
  pending: PendingChannel,
): JSBError | undefined {
  pendingChannels.set(channelId, pending);

  try {
    const nativeBridge = window.__JSB__;
    if (!nativeBridge) {
      throw new JSBError(
        "JSB_NATIVE_NOT_AVAILABLE",
        "The native JSB bridge is not available.",
      );
    }
    nativeBridge.openChannel(channelId);
    return undefined;
  } catch (error) {
    pendingChannels.delete(channelId);
    return toJSBError(
      error,
      "JSB_CHANNEL_OPEN_FAILED",
      "Could not open JSB channel.",
    );
  }
}

export function cancelNativeChannelRequest(channelId: string): void {
  pendingChannels.delete(channelId);
}

export function closeNativeChannel(channelId: string): JSBError | undefined {
  try {
    window.__JSB__?.closeChannel(channelId);
    return undefined;
  } catch (error) {
    return toJSBError(
      error,
      "JSB_CHANNEL_CLOSE_FAILED",
      "Could not close JSB channel.",
    );
  }
}
