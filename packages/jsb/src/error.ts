export class JSBError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "JSBError";
  }
}

export function toJSBError(
  error: unknown,
  code: string,
  message: string,
): JSBError {
  return error instanceof JSBError
    ? error
    : new JSBError(code, error instanceof Error ? error.message : message);
}
