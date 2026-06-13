import { Channel, invoke } from "@tauri-apps/api/core";
import { v4 as uuidV4 } from "uuid";

export type PtyShellSize = {
  col: number;
  row: number;
  width: number;
  height: number;
};

export type PtyShellOpenOpts = {
  size: PtyShellSize;
  shell?: string;
};

export type PtyShellOpts = {
  onData?: (data: Uint8Array) => unknown;
  onClose?: () => unknown;
};

export type PtyShellIpcChannelEventJson = {
  type: "Close";
};

export type PtyShellIpcChannelEvent = ArrayBuffer | PtyShellIpcChannelEventJson;

export class PtyShell {
  shellId: string;
  #opened = false;
  private opts: PtyShellOpts;

  constructor(opts: PtyShellOpts) {
    this.shellId = uuidV4();
    this.opts = opts;
  }

  async open(opts: PtyShellOpenOpts): Promise<string> {
    const result = await invoke<string>("plugin:pty|shell_open", {
      shellId: this.shellId,
      size: opts.size,
      shell: opts.shell ?? null,
      ipcChannel: new Channel<PtyShellIpcChannelEvent>((data) => {
        if (data instanceof ArrayBuffer) {
          this.opts.onData?.(new Uint8Array(data));
          return;
        }
        if (data.type === "Close") {
          this.opts.onClose?.();
        }
      }),
    });
    this.#opened = true;
    return result;
  }

  send(data: string): Promise<void> {
    if (!this.#opened) {
      return Promise.resolve();
    }
    return invoke("plugin:pty|shell_send", {
      shellId: this.shellId,
      data: data,
    });
  }

  resize(size: PtyShellSize): Promise<void> {
    if (!this.#opened) {
      return Promise.resolve();
    }
    return invoke("plugin:pty|shell_resize", {
      shellId: this.shellId,
      size,
    });
  }

  async close(): Promise<void> {
    this.#opened = false;
    return invoke("plugin:pty|shell_close", {
      shellId: this.shellId,
    });
  }
}
