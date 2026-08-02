import { commands } from "@skipperndt/plugin-machine-uid";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  ask,
  open,
  save,
  type OpenDialogOptions as TauriOpenDialogOptions,
  type SaveDialogOptions as TauriSaveDialogOptions,
} from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  BaseDirectory as TauriBaseDirectory,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { relaunch } from "@tauri-apps/plugin-process";
import { LazyStore as TauriLazyStore } from "@tauri-apps/plugin-store";
import { check } from "@tauri-apps/plugin-updater";
import * as data from "tauri-plugin-data";
import { PtyShell as TauriPtyShell } from "tauri-plugin-pty";
import {
  SSHPortForwarding as TauriSSHPortForwarding,
  SSHSession as TauriSSHSession,
  SSHSftp as TauriSSHSftp,
  SSHShell as TauriSSHShell,
} from "tauri-plugin-ssh";

import type {
  BridgeBackend,
  PtyShellImplementation,
  SSHPortForwardingImplementation,
  SSHSessionImplementation,
  SSHSftpImplementation,
  SSHShellImplementation,
} from "./backend";
import { setBridgeBackend } from "./backend";
import { BaseDirectory, type FileOptions, type WriteFileOptions } from "./fs";
import type { Store } from "./store";

function resolveBaseDir(opts?: FileOptions) {
  if (opts?.baseDir === BaseDirectory.AppLocalData) {
    return TauriBaseDirectory.AppLocalData;
  }
  return undefined;
}

function createStore(path: string): Store {
  const store = new TauriLazyStore(path);
  return {
    async get<T>(key: string) {
      return (await store.get<T>(key)) ?? null;
    },
    set(key, value) {
      return store.set(key, value);
    },
    save() {
      return store.save();
    },
    onKeyChange<T>(key: string, callback: (value: T | undefined) => void) {
      return store.onKeyChange<T>(key, callback);
    },
  };
}

export function createTauriBackend(): BridgeBackend {
  return {
    capabilities: {
      has: () => true,
    },
    data: data as unknown as BridgeBackend["data"],
    ssh: {
      createSession: (opts) =>
        new TauriSSHSession(opts) as unknown as SSHSessionImplementation,
      createShell: (session, opts) =>
        new TauriSSHShell({
          session: session as unknown as TauriSSHSession,
          ...opts,
        }) as unknown as SSHShellImplementation,
      createSftp: (session, opts) =>
        new TauriSSHSftp({
          session: session as unknown as TauriSSHSession,
          ...opts,
        }) as unknown as SSHSftpImplementation,
      createPortForwarding: (session) =>
        new TauriSSHPortForwarding({
          session: session as unknown as TauriSSHSession,
        }) as unknown as SSHPortForwardingImplementation,
    },
    pty: {
      createShell: (opts) =>
        new TauriPtyShell(opts) as unknown as PtyShellImplementation,
    },
    app: {
      getVersion,
      setSystemBarsAppearance: async () => {},
    },
    machineUid: {
      async getMachineUid() {
        const result = await commands.getMachineUid();
        return result.status === "ok" ? result.data.id || undefined : undefined;
      },
    },
    core: {
      generateKey: (opts) => invoke("generate_key", opts),
      openUrl: (url) => invoke("open_url", { url }),
    },
    dialog: {
      openDialog: (opts) =>
        open(opts as TauriOpenDialogOptions) as Promise<
          string | string[] | null
        >,
      saveDialog: (opts) => save(opts as TauriSaveDialogOptions),
      ask,
      async destroyDialogPath(path) {
        if (path !== null) {
          await invoke("plugin:dialog|destroy_path", { path });
        }
      },
    },
    fs: {
      readTextFile: (path, opts) =>
        readTextFile(path, {
          baseDir: resolveBaseDir(opts),
        }),
      writeTextFile: (path, contents, opts?: WriteFileOptions) =>
        writeTextFile(path, contents, {
          baseDir: resolveBaseDir(opts),
          create: opts?.create,
        }),
    },
    window: {
      getCurrentWindow,
    },
    store: {
      createStore,
    },
    clipboardManager: {
      readClipboardText: readText,
      writeClipboardText: writeText,
    },
    updater: {
      checkUpdate: check,
    },
    process: {
      relaunch,
    },
  };
}

export function installTauriBackend(): void {
  setBridgeBackend(createTauriBackend());
}
