import type {
  JSBEmitMessage,
  JSBErrorPayload,
  JSBIncomingMessage,
  JSBInvokeRequest,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === "string";
}

function parseErrorPayload(value: unknown): JSBErrorPayload | undefined {
  if (
    !isRecord(value) ||
    !isOptionalString(value.code) ||
    !isOptionalString(value.message)
  ) {
    return undefined;
  }

  return {
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.message === "string" ? { message: value.message } : {}),
    ...(value.details === undefined ? {} : { details: value.details }),
  };
}

function parseEmitMessage(
  message: Record<string, unknown>,
): JSBEmitMessage | undefined {
  if (
    typeof message.event !== "string" ||
    !isOptionalString(message.targetId) ||
    !isOptionalString(message.clientId) ||
    (message.sequence != null && typeof message.sequence !== "number")
  ) {
    return undefined;
  }

  return {
    type: "emit",
    event: message.event,
    ...(message.payload === undefined ? {} : { payload: message.payload }),
    ...(typeof message.targetId === "string"
      ? { targetId: message.targetId }
      : {}),
    ...(typeof message.clientId === "string"
      ? { clientId: message.clientId }
      : {}),
    ...(typeof message.sequence === "number"
      ? { sequence: message.sequence }
      : {}),
  };
}

function parseInvokeResponse(
  message: Record<string, unknown>,
): JSBIncomingMessage | undefined {
  if (typeof message.id !== "string") {
    return undefined;
  }

  if ("error" in message) {
    const error = parseErrorPayload(message.error);
    return error
      ? { type: "invoke.response", id: message.id, error }
      : undefined;
  }

  return "data" in message
    ? { type: "invoke.response", id: message.id, data: message.data }
    : undefined;
}

export function parseIncomingMessage(
  value: string,
): JSBIncomingMessage | undefined {
  try {
    const message: unknown = JSON.parse(value);
    if (!isRecord(message)) {
      return undefined;
    }

    if (message.type === "emit") {
      return parseEmitMessage(message);
    }
    if (message.type === "invoke.response") {
      return parseInvokeResponse(message);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function serializeInvokeRequest<TRequest>(
  request: JSBInvokeRequest<TRequest>,
): string {
  return JSON.stringify(request);
}
