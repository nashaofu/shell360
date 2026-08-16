import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { JsbTransport } from "../../jsb/src/index";

export type TauriJsbLocalHandler = (
  method: string,
  params: unknown,
) => Promise<unknown> | undefined;

export class TauriJsbTransport implements JsbTransport {
  private handler: ((message: string) => void) | null = null;
  private localHandler?: TauriJsbLocalHandler;

  constructor(localHandler?: TauriJsbLocalHandler) {
    this.localHandler = localHandler;
  }

  setLocalHandler(localHandler: TauriJsbLocalHandler): void {
    this.localHandler = localHandler;
  }

  emit(event: string, payload: unknown, targetId?: string): void {
    this.handler?.(
      JSON.stringify({
        type: "emit",
        event,
        targetId,
        payload,
      }),
    );
  }

  listenDataEvents(): void {
    void listen<boolean>("data://authed_change", (event) => {
      this.handler?.(
        JSON.stringify({
          type: "emit",
          event: "data.authedChange",
          payload: event.payload,
        }),
      );
    });
  }

  send(message: string): void {
    const request = JSON.parse(message) as {
      id: string;
      method: string;
      params?: unknown;
    };
    const localResult = this.localHandler?.(request.method, request.params);
    if (localResult !== undefined) {
      void localResult
        .then((result) => {
          this.handler?.(
            JSON.stringify({ type: "result", id: request.id, result }),
          );
        })
        .catch((error: unknown) => {
          this.handler?.(
            JSON.stringify({
              type: "result",
              id: request.id,
              error: {
                code: "JSB_NATIVE_ERROR",
                message: error instanceof Error ? error.message : String(error),
              },
            }),
          );
        });
      return;
    }
    void invoke<string>("jsb_invoke", { message }).then((response) => {
      this.handler?.(response);
    });
  }

  setMessageHandler(handler: ((message: string) => void) | null): void {
    this.handler = handler;
  }
}
