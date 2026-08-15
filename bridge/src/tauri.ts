import { commands } from "@skipperndt/plugin-machine-uid";
import { v4 as uuidv4 } from "uuid";
import jsb from "../../jsb/src/index";
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
import { TauriJsbTransport } from "./tauri-jsb";
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
      generateKey: (opts) => jsb.invoke("keygen.generate", opts),
      openUrl: (url) => jsb.invoke("core.openUrl", { url }),
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

function createJsbTauriBackend(direct: BridgeBackend): BridgeBackend {
  return {
    ...direct,
    data: {
      ...direct.data,
      checkIsEnableCrypto: () => jsb.invoke("data.checkIsEnableCrypto"),
      checkIsInitCrypto: () => jsb.invoke("data.checkIsInitCrypto"),
      checkIsAuthed: () => jsb.invoke("data.checkIsAuthed"),
      onAuthedChange: async (callback) =>
        jsb.on("data.authedChange", (payload) => callback(payload === true)),
      initCryptoKey: () => jsb.invoke("data.initCryptoKey"),
      initCryptoPassword: (opts) => jsb.invoke("data.initCryptoPassword", opts),
      loadCryptoByPassword: (opts) => jsb.invoke("data.loadCryptoByPassword", opts),
      changeCryptoPassword: (opts) => jsb.invoke("data.changeCryptoPassword", opts),
      initCryptoBiometric: () => jsb.invoke("data.initCryptoBiometric"),
      loadCryptoByBiometric: () => jsb.invoke("data.loadCryptoByBiometric"),
      changeCryptoEnable: (opts) => jsb.invoke("data.changeCryptoEnable", opts),
      resetCrypto: () => jsb.invoke("data.resetCrypto"),
      rotateCryptoKey: (password) => jsb.invoke("data.rotateCryptoKey", { password }),
      getHosts: () => jsb.invoke("data.getHosts"),
      addHost: (host) => jsb.invoke("data.addHost", host),
      updateHost: (host) => jsb.invoke("data.updateHost", host),
      deleteHost: (host) => jsb.invoke("data.deleteHost", host),
      getKeys: () => jsb.invoke("data.getKeys"),
      addKey: (key) => jsb.invoke("data.addKey", key),
      updateKey: (key) => jsb.invoke("data.updateKey", key),
      deleteKey: (key) => jsb.invoke("data.deleteKey", key),
      getPortForwardings: () => jsb.invoke("data.getPortForwardings"),
      addPortForwarding: (value) => jsb.invoke("data.addPortForwarding", value),
      updatePortForwarding: (value) => jsb.invoke("data.updatePortForwarding", value),
      deletePortForwarding: (value) => jsb.invoke("data.deletePortForwarding", value),
    },
    app: {
      ...direct.app,
      getVersion: () => jsb.invoke("app.getVersion"),
    },
    ssh: {
      createSession: (opts) => {
        const sshSessionId = uuidv4();
        jsb.on("ssh.session.disconnect", (payload, meta) => {
          if (meta?.targetId === sshSessionId) {
            opts.onDisconnect?.({ type: "disconnect", data: payload as never });
          }
        });
        return {
          sshSessionId,
          connect: (value, checkServerKey) => jsb.invoke("ssh.session.connect", { sshSessionId, ...value, checkServerKey }),
          authenticate_password: (value) => jsb.invoke("ssh.session.authenticatePassword", { sshSessionId, ...value }),
          authenticate_public_key: (value) => jsb.invoke("ssh.session.authenticatePublicKey", { sshSessionId, ...value }),
          authenticate_certificate: (value) => jsb.invoke("ssh.session.authenticateCertificate", { sshSessionId, ...value }),
          authenticate_keyboard_interactive: (value) => jsb.invoke("ssh.session.authenticateKeyboardInteractive", { sshSessionId, ...value }),
          authenticate_agent: (value) => jsb.invoke("ssh.session.authenticateAgent", { sshSessionId, ...value }),
          disconnect: () => jsb.invoke("ssh.session.disconnect", { sshSessionId }),
        };
      },
      createShell: (session, opts) => {
        const sshShellId = uuidv4();
        jsb.on("ssh.shell.data", (payload, meta) => {
          if (meta?.targetId === sshShellId && typeof payload === "string") opts.onData?.(decodeBase64(payload));
        });
        jsb.on("ssh.shell.eof", (_payload, meta) => {
          if (meta?.targetId === sshShellId) opts.onEof?.();
        });
        jsb.on("ssh.shell.close", (_payload, meta) => {
          if (meta?.targetId === sshShellId) opts.onClose?.();
        });
        return {
          sshShellId,
          open: (value) => jsb.invoke("ssh.shell.open", { sshSessionId: session.sshSessionId, sshShellId, ...value }),
          close: () => jsb.invoke("ssh.shell.close", { sshShellId }),
          send: (value) => jsb.invoke("ssh.shell.send", { sshShellId, data: encodeBase64(typeof value === "string" ? new TextEncoder().encode(value) : value) }),
          resize: (value) => jsb.invoke("ssh.shell.resize", { sshShellId, size: value }),
        };
      },
      createSftp: (session, opts) => {
        const sshSftpId = uuidv4();
        jsb.on("ssh.sftp.eof", (_payload, meta) => {
          if (meta?.targetId === sshSftpId) opts.onEof?.();
        });
        jsb.on("ssh.sftp.close", (_payload, meta) => {
          if (meta?.targetId === sshSftpId) opts.onClose?.();
        });
        return {
          sshSftpId,
          open: () => jsb.invoke("ssh.sftp.open", { sshSessionId: session.sshSessionId, sshSftpId }),
          close: () => jsb.invoke("ssh.sftp.close", { sshSftpId }),
          sftpReadDir: (path) => jsb.invoke("ssh.sftp.readDir", { sshSftpId, path }),
          sftpUploadFile: (value) => jsb.invoke("ssh.sftp.uploadFile", { sshSftpId, ...value }),
          sftpDownloadFile: (value) => jsb.invoke("ssh.sftp.downloadFile", { sshSftpId, ...value }),
          sftpCreateFile: (path) => jsb.invoke("ssh.sftp.createFile", { sshSftpId, path }),
          sftpCreateDir: (path) => jsb.invoke("ssh.sftp.createDir", { sshSftpId, path }),
          sftpRemoveDir: (path) => jsb.invoke("ssh.sftp.removeDir", { sshSftpId, path }),
          sftpRemoveFile: (path) => jsb.invoke("ssh.sftp.removeFile", { sshSftpId, path }),
          sftpRename: (value) => jsb.invoke("ssh.sftp.rename", { sshSftpId, ...value }),
          sftpExists: (path) => jsb.invoke("ssh.sftp.exists", { sshSftpId, path }),
          sftpCanonicalize: (path) => jsb.invoke("ssh.sftp.canonicalize", { sshSftpId, path }),
          sftpReadTextFile: (path) => jsb.invoke("ssh.sftp.readTextFile", { sshSftpId, path }),
          sftpWriteTextFile: (path, content) => jsb.invoke("ssh.sftp.writeTextFile", { sshSftpId, path, content }),
          sftpCancelTask: (taskId) => jsb.invoke("ssh.sftp.cancelTask", { sshSftpId, taskId }),
          sftpPauseTask: (taskId) => jsb.invoke("ssh.sftp.pauseTask", { sshSftpId, taskId }),
          sftpResumeTask: (taskId) => jsb.invoke("ssh.sftp.resumeTask", { sshSftpId, taskId }),
        };
      },
      createPortForwarding: (session) => {
        const sshPortForwardingId = uuidv4();
        const invokeForward = (method: string, value?: object) => jsb.invoke<unknown, string>(method, {
          sshSessionId: session.sshSessionId,
          sshPortForwardingId,
          ...value,
        });
        return {
          sshPortForwardingId,
          openLocalPortForwarding: (value) => invokeForward("ssh.portForwarding.openLocal", value),
          closeLocalPortForwarding: () => invokeForward("ssh.portForwarding.closeLocal"),
          openRemotePortForwarding: (value) => invokeForward("ssh.portForwarding.openRemote", value),
          closeRemotePortForwarding: () => invokeForward("ssh.portForwarding.closeRemote"),
          openDynamicPortForwarding: (value) => invokeForward("ssh.portForwarding.openDynamic", value),
          closeDynamicPortForwarding: () => invokeForward("ssh.portForwarding.closeDynamic"),
        };
      },
    },
    pty: {
      createShell: (opts) => {
        const shellId = uuidv4();
        jsb.on("pty.shell.data", (payload, meta) => {
          if (meta?.targetId === shellId && typeof payload === "string") opts.onData?.(decodeBase64(payload));
        });
        jsb.on("pty.shell.exit", (payload, meta) => {
          if (meta?.targetId === shellId) opts.onExit?.(payload as number | null);
        });
        return {
          shellId,
          open: (value) => jsb.invoke("pty.shell.open", { shellId, ...value }),
          send: (value) => jsb.invoke("pty.shell.send", { shellId, data: encodeBase64(typeof value === "string" ? new TextEncoder().encode(value) : value) }),
          resize: (value) => jsb.invoke("pty.shell.resize", { shellId, size: value }),
          close: () => jsb.invoke("pty.shell.close", { shellId }),
        };
      },
    },
    dialog: {
      ...direct.dialog,
      openDialog: (opts) => jsb.invoke("dialog.open", opts),
      saveDialog: (opts) => jsb.invoke("dialog.save", opts),
      destroyDialogPath: (path) => jsb.invoke("dialog.destroyPath", path),
    },
    fs: {
      ...direct.fs,
      readTextFile: (path, opts) => jsb.invoke("fs.readTextFile", { path, ...opts }),
      writeTextFile: (path, contents, opts) => jsb.invoke("fs.writeTextFile", { path, contents, ...opts }),
    },
    clipboardManager: {
      readClipboardText: () => jsb.invoke("clipboard.readText"),
      writeClipboardText: (text) => jsb.invoke("clipboard.writeText", { text }),
    },
    updater: {
      checkUpdate: () => jsb.invoke("updater.check"),
    },
    process: {
      relaunch: () => jsb.invoke("process.relaunch"),
    },
    machineUid: {
      getMachineUid: () => jsb.invoke("machineUid.getMachineUid"),
    },
    window: {
      ...direct.window,
      getCurrentWindow: () => ({
        ...direct.window.getCurrentWindow(),
        close: () => jsb.invoke("window.close"),
      }),
    },
    store: {
      createStore: (path) => {
        const storeId = uuidv4();
        void jsb.invoke("store.create", { storeId, path });
        return {
          get: <T>(key: string) => jsb.invoke<unknown, T | null>("store.get", { storeId, key }),
          set: (key: string, value: unknown) => jsb.invoke("store.set", { storeId, key, value }),
          save: () => jsb.invoke("store.save", { storeId }),
          onKeyChange: async <T>(key: string, callback: (value: T | undefined) => void) => {
            await jsb.invoke("store.onKeyChange", { storeId, key });
            return jsb.on("store.keyChange", (value, meta) => {
              if (meta?.targetId === `${storeId}:${key}`) callback(value as T | undefined);
            });
          },
        };
      },
    },
  };
}

export function installTauriBackend(): void {
  const direct = createTauriBackend();
  const transport = new TauriJsbTransport();
  transport.setLocalHandler(createTauriLocalHandler(direct, (event, payload, targetId) => {
    transport.emit(event, payload, targetId);
  }));
  transport.listenDataEvents();
    jsb.setClientId("tauri-main");
    jsb.attachTransport(transport);
  setBridgeBackend(createJsbTauriBackend(direct));
}

function createTauriLocalHandler(
  direct: BridgeBackend,
  emit: (event: string, payload: unknown, targetId?: string) => void,
): (method: string, params: unknown) => Promise<unknown> | undefined {
  const sessions = new Map<string, SSHSessionImplementation>();
  const shells = new Map<string, SSHShellImplementation>();
  const sftps = new Map<string, SSHSftpImplementation>();
  const forwards = new Map<string, SSHPortForwardingImplementation>();
  const ptyShells = new Map<string, PtyShellImplementation>();
  const stores = new Map<string, Store>();
  return (method, params) => {
    switch (method) {
      case "data.checkIsEnableCrypto": return data.checkIsEnableCrypto();
      case "data.checkIsInitCrypto": return data.checkIsInitCrypto();
      case "data.checkIsAuthed": return data.checkIsAuthed();
      case "data.initCryptoKey": return data.initCryptoKey();
      case "data.initCryptoPassword": return data.initCryptoPassword(params as Parameters<typeof data.initCryptoPassword>[0]);
      case "data.loadCryptoByPassword": return data.loadCryptoByPassword(params as Parameters<typeof data.loadCryptoByPassword>[0]);
      case "data.changeCryptoPassword": return data.changeCryptoPassword(params as Parameters<typeof data.changeCryptoPassword>[0]);
      case "data.initCryptoBiometric": return data.initCryptoBiometric();
      case "data.loadCryptoByBiometric": return data.loadCryptoByBiometric();
      case "data.changeCryptoEnable": return data.changeCryptoEnable(params as Parameters<typeof data.changeCryptoEnable>[0]);
      case "data.resetCrypto": return data.resetCrypto();
      case "data.rotateCryptoKey": return data.rotateCryptoKey((params as { password: string }).password);
      case "data.getHosts": return data.getHosts();
      case "data.addHost": return data.addHost(params as Parameters<typeof data.addHost>[0]);
      case "data.updateHost": return data.updateHost(params as Parameters<typeof data.updateHost>[0]);
      case "data.deleteHost": return data.deleteHost(params as Parameters<typeof data.deleteHost>[0]);
      case "data.getKeys": return data.getKeys();
      case "data.addKey": return data.addKey(params as Parameters<typeof data.addKey>[0]);
      case "data.updateKey": return data.updateKey(params as Parameters<typeof data.updateKey>[0]);
      case "data.deleteKey": return data.deleteKey(params as Parameters<typeof data.deleteKey>[0]);
      case "data.getPortForwardings": return data.getPortForwardings();
      case "data.addPortForwarding": return data.addPortForwarding(params as Parameters<typeof data.addPortForwarding>[0]);
      case "data.updatePortForwarding": return data.updatePortForwarding(params as Parameters<typeof data.updatePortForwarding>[0]);
      case "data.deletePortForwarding": return data.deletePortForwarding(params as Parameters<typeof data.deletePortForwarding>[0]);
      case "dialog.open": return direct.dialog.openDialog(params as Parameters<BridgeBackend["dialog"]["openDialog"]>[0]);
      case "dialog.save": return direct.dialog.saveDialog(params as Parameters<BridgeBackend["dialog"]["saveDialog"]>[0]);
      case "dialog.destroyPath": return direct.dialog.destroyDialogPath(params as string | string[] | null);
      case "fs.readTextFile": {
        const value = params as { path: string } & FileOptions;
        return direct.fs.readTextFile(value.path, value);
      }
      case "fs.writeTextFile": {
        const value = params as { path: string; contents: string } & WriteFileOptions;
        return direct.fs.writeTextFile(value.path, value.contents, value);
      }
      case "clipboard.readText": return readText();
      case "clipboard.writeText": return writeText((params as { text: string }).text);
      case "process.relaunch": return relaunch();
      case "updater.check": return check();
      case "machineUid.getMachineUid": return commands.getMachineUid().then((result) => result.status === "ok" ? result.data.id || undefined : undefined);
      case "window.close": return direct.window.getCurrentWindow().close();
      case "store.create": {
        const value = params as { storeId: string; path: string };
        stores.set(value.storeId, direct.store.createStore(value.path));
        return Promise.resolve(null);
      }
      case "store.get": {
        const value = params as { storeId: string; key: string };
        return stores.get(value.storeId)?.get(value.key);
      }
      case "store.set": {
        const value = params as { storeId: string; key: string; value: unknown };
        return stores.get(value.storeId)?.set(value.key, value.value);
      }
      case "store.save": return stores.get((params as { storeId: string }).storeId)?.save();
      case "store.onKeyChange": {
        const value = params as { storeId: string; key: string };
        return stores.get(value.storeId)?.onKeyChange(value.key, (nextValue) => {
          emit("store.keyChange", nextValue, `${value.storeId}:${value.key}`);
        }).then(() => null);
      }
      case "ssh.session.connect": {
        const value = params as { sshSessionId: string; checkServerKey?: unknown } & Record<string, unknown>;
        const session = sessions.get(value.sshSessionId) ?? direct.ssh.createSession({
          onDisconnect: (event) => emit("ssh.session.disconnect", event.data, value.sshSessionId),
        });
        sessions.set(value.sshSessionId, session);
        return session.connect(value as never, value.checkServerKey as never);
      }
      case "ssh.session.authenticatePassword": return sessions.get((params as { sshSessionId: string }).sshSessionId)?.authenticate_password(params as never);
      case "ssh.session.authenticatePublicKey": return sessions.get((params as { sshSessionId: string }).sshSessionId)?.authenticate_public_key(params as never);
      case "ssh.session.authenticateCertificate": return sessions.get((params as { sshSessionId: string }).sshSessionId)?.authenticate_certificate(params as never);
      case "ssh.session.authenticateKeyboardInteractive": return sessions.get((params as { sshSessionId: string }).sshSessionId)?.authenticate_keyboard_interactive(params as never);
      case "ssh.session.authenticateAgent": return sessions.get((params as { sshSessionId: string }).sshSessionId)?.authenticate_agent(params as never);
      case "ssh.session.disconnect": {
        const value = params as { sshSessionId: string };
        const session = sessions.get(value.sshSessionId);
        sessions.delete(value.sshSessionId);
        return session?.disconnect();
      }
      case "ssh.shell.open": {
        const value = params as { sshShellId: string; sshSessionId: string } & Record<string, unknown>;
        const session = sessions.get(value.sshSessionId);
        if (!session) return Promise.reject(new Error("SSH session is not open."));
        const shell = shells.get(value.sshShellId) ?? direct.ssh.createShell(session, {
          onData: (data) => emit("ssh.shell.data", encodeBase64(data), value.sshShellId),
          onEof: () => emit("ssh.shell.eof", null, value.sshShellId),
          onClose: () => emit("ssh.shell.close", null, value.sshShellId),
        });
        shells.set(value.sshShellId, shell);
        return shell.open(value as never);
      }
      case "ssh.shell.send": return shells.get((params as { sshShellId: string }).sshShellId)?.send(decodeBase64((params as { data: string }).data));
      case "ssh.shell.resize": return shells.get((params as { sshShellId: string }).sshShellId)?.resize((params as { size: never }).size);
      case "ssh.shell.close": {
        const value = params as { sshShellId: string };
        const shell = shells.get(value.sshShellId);
        shells.delete(value.sshShellId);
        return shell?.close();
      }
      case "ssh.sftp.open": {
        const value = params as { sshSftpId: string; sshSessionId: string };
        const session = sessions.get(value.sshSessionId);
        if (!session) return Promise.reject(new Error("SSH session is not open."));
        const sftp = sftps.get(value.sshSftpId) ?? direct.ssh.createSftp(session, {
          onEof: () => emit("ssh.sftp.eof", null, value.sshSftpId),
          onClose: () => emit("ssh.sftp.close", null, value.sshSftpId),
        });
        sftps.set(value.sshSftpId, sftp);
        return sftp.open();
      }
      case "ssh.sftp.close": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.close();
      case "ssh.sftp.readDir": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpReadDir((params as { path: string }).path);
      case "ssh.sftp.uploadFile": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpUploadFile(params as never);
      case "ssh.sftp.downloadFile": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpDownloadFile(params as never);
      case "ssh.sftp.createFile": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpCreateFile((params as { path: string }).path);
      case "ssh.sftp.createDir": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpCreateDir((params as { path: string }).path);
      case "ssh.sftp.removeDir": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpRemoveDir((params as { path: string }).path);
      case "ssh.sftp.removeFile": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpRemoveFile((params as { path: string }).path);
      case "ssh.sftp.rename": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpRename(params as never);
      case "ssh.sftp.exists": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpExists((params as { path: string }).path);
      case "ssh.sftp.canonicalize": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpCanonicalize((params as { path: string }).path);
      case "ssh.sftp.readTextFile": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpReadTextFile((params as { path: string }).path);
      case "ssh.sftp.writeTextFile": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpWriteTextFile((params as { path: string }).path, (params as { content: string }).content);
      case "ssh.sftp.cancelTask": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpCancelTask((params as { taskId: string }).taskId);
      case "ssh.sftp.pauseTask": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpPauseTask((params as { taskId: string }).taskId);
      case "ssh.sftp.resumeTask": return sftps.get((params as { sshSftpId: string }).sshSftpId)?.sftpResumeTask((params as { taskId: string }).taskId);
      case "ssh.portForwarding.openLocal": return getForwarding(direct, forwards, sessions, params).then((forward) => forward.openLocalPortForwarding(params as never));
      case "ssh.portForwarding.closeLocal": return forwards.get((params as { sshPortForwardingId: string }).sshPortForwardingId)?.closeLocalPortForwarding();
      case "ssh.portForwarding.openRemote": return getForwarding(direct, forwards, sessions, params).then((forward) => forward.openRemotePortForwarding(params as never));
      case "ssh.portForwarding.closeRemote": return forwards.get((params as { sshPortForwardingId: string }).sshPortForwardingId)?.closeRemotePortForwarding();
      case "ssh.portForwarding.openDynamic": return getForwarding(direct, forwards, sessions, params).then((forward) => forward.openDynamicPortForwarding(params as never));
      case "ssh.portForwarding.closeDynamic": return forwards.get((params as { sshPortForwardingId: string }).sshPortForwardingId)?.closeDynamicPortForwarding();
      case "pty.shell.open": {
        const value = params as { shellId: string } & Record<string, unknown>;
        const shell = ptyShells.get(value.shellId) ?? direct.pty.createShell({
          onData: (data) => emit("pty.shell.data", encodeBase64(data), value.shellId),
          onExit: (code) => emit("pty.shell.exit", code, value.shellId),
        });
        ptyShells.set(value.shellId, shell);
        return shell.open(value as never);
      }
      case "pty.shell.send": return ptyShells.get((params as { shellId: string }).shellId)?.send(decodeBase64((params as { data: string }).data));
      case "pty.shell.resize": return ptyShells.get((params as { shellId: string }).shellId)?.resize((params as { size: never }).size);
      case "pty.shell.close": {
        const value = params as { shellId: string };
        const shell = ptyShells.get(value.shellId);
        ptyShells.delete(value.shellId);
        return shell?.close();
      }
      default: return undefined;
    }
  };
}

function encodeBase64(data: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < data.length; offset += 0x8000) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getForwarding(
  direct: BridgeBackend,
  forwards: Map<string, SSHPortForwardingImplementation>,
  sessions: Map<string, SSHSessionImplementation>,
  params: unknown,
): Promise<SSHPortForwardingImplementation> {
  const value = params as { sshPortForwardingId: string; sshSessionId: string };
  const session = sessions.get(value.sshSessionId);
  if (!session) throw new Error("SSH session is not open.");
  const forwarding = forwards.get(value.sshPortForwardingId) ?? direct.ssh.createPortForwarding(session);
  forwards.set(value.sshPortForwardingId, forwarding);
  return forwarding;
}
