import { getBridgeBackend, type PtyShellImplementation } from "./backend";

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
  onExit?: (code: number | null) => unknown;
};

export class PtyShell {
  private readonly implementation: PtyShellImplementation;

  constructor(opts: PtyShellOpts) {
    this.implementation = getBridgeBackend().pty.createShell(opts);
  }

  get shellId(): string {
    return this.implementation.shellId;
  }

  open(opts: PtyShellOpenOpts) {
    return this.implementation.open(opts);
  }

  send(data: string | Uint8Array) {
    return this.implementation.send(data);
  }

  resize(size: PtyShellSize) {
    return this.implementation.resize(size);
  }

  close() {
    return this.implementation.close();
  }
}
