import { getBridgeBackend } from "./backend";

export type UnlistenFn = () => void;

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
  onKeyChange<T>(
    key: string,
    callback: (value: T | undefined) => void,
  ): Promise<UnlistenFn>;
}

export class LazyStore implements Store {
  private implementation?: Store;

  constructor(private readonly path: string) {}

  private get store(): Store {
    this.implementation ??= getBridgeBackend().store.createStore(this.path);
    return this.implementation;
  }

  get<T>(key: string) {
    return this.store.get<T>(key);
  }

  set(key: string, value: unknown) {
    return this.store.set(key, value);
  }

  save() {
    return this.store.save();
  }

  onKeyChange<T>(key: string, callback: (value: T | undefined) => void) {
    return this.store.onKeyChange(key, callback);
  }
}
