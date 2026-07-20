import { getBridgeBackend } from "./backend";

export interface HostTerminalSettings {
  fontFamily?: string;
  fontSize?: number;
  theme?: string;
}

export enum AuthenticationMethod {
  Password = "Password",
  PublicKey = "PublicKey",
  Certificate = "Certificate",
  Agent = "Agent",
  KeyboardInteractive = "KeyboardInteractive",
}

export interface Env {
  key: string;
  value: string;
}

export interface Host {
  id: string;
  name?: string;
  tags?: string[];
  hostname: string;
  port: number;
  username: string;
  authenticationMethod: AuthenticationMethod;
  password?: string;
  keyId?: string;
  startupCommand?: string;
  terminalType?: string;
  envs?: Env[];
  jumpHostIds?: string[];
  terminalSettings?: HostTerminalSettings;
}

export interface Key {
  id: string;
  name: string;
  privateKey: string;
  publicKey: string;
  passphrase?: string;
  certificate?: string;
}

export enum PortForwardingType {
  Local = "Local",
  Remote = "Remote",
  Dynamic = "Dynamic",
}

export interface PortForwarding {
  id: string;
  name: string;
  portForwardingType: PortForwardingType;
  hostId: string;
  localAddress: string;
  localPort: number;
  remoteAddress?: string;
  remotePort?: number;
}

export interface InitCryptoPasswordOpts extends Record<string, unknown> {
  password: string;
  confirmPassword: string;
}

export interface LoadCryptoByPasswordOpts extends Record<string, unknown> {
  password: string;
}

export interface ChangeCryptoPasswordOpts extends Record<string, unknown> {
  oldPassword: string;
  password: string;
  confirmPassword: string;
}

export interface ChangeCryptoEnableOpts extends Record<string, unknown> {
  cryptoEnable: boolean;
  password?: string;
  confirmPassword?: string;
}

export const checkIsEnableCrypto = () =>
  getBridgeBackend().data.checkIsEnableCrypto();
export const checkIsInitCrypto = () =>
  getBridgeBackend().data.checkIsInitCrypto();
export const checkIsAuthed = () => getBridgeBackend().data.checkIsAuthed();
export const onAuthedChange = (
  callback: (isAuthed: boolean) => unknown,
): Promise<() => void> => getBridgeBackend().data.onAuthedChange(callback);
export const initCryptoKey = () => getBridgeBackend().data.initCryptoKey();
export const initCryptoPassword = (opts: InitCryptoPasswordOpts) =>
  getBridgeBackend().data.initCryptoPassword(opts);
export const loadCryptoByPassword = (opts: LoadCryptoByPasswordOpts) =>
  getBridgeBackend().data.loadCryptoByPassword(opts);
export const changeCryptoPassword = (opts: ChangeCryptoPasswordOpts) =>
  getBridgeBackend().data.changeCryptoPassword(opts);
export const initCryptoBiometric = () =>
  getBridgeBackend().data.initCryptoBiometric();
export const loadCryptoByBiometric = () =>
  getBridgeBackend().data.loadCryptoByBiometric();
export const changeCryptoEnable = (opts: ChangeCryptoEnableOpts) =>
  getBridgeBackend().data.changeCryptoEnable(opts);
export const resetCrypto = () => getBridgeBackend().data.resetCrypto();
export const rotateCryptoKey = (password: string) =>
  getBridgeBackend().data.rotateCryptoKey(password);

export const getHosts = () => getBridgeBackend().data.getHosts();
export const addHost = (host: Omit<Host, "id">) =>
  getBridgeBackend().data.addHost(host);
export const updateHost = (host: Host) =>
  getBridgeBackend().data.updateHost(host);
export const deleteHost = (host: Host) =>
  getBridgeBackend().data.deleteHost(host);

export const getKeys = () => getBridgeBackend().data.getKeys();
export const addKey = (key: Omit<Key, "id">) =>
  getBridgeBackend().data.addKey(key);
export const updateKey = (key: Key) => getBridgeBackend().data.updateKey(key);
export const deleteKey = (key: Key) => getBridgeBackend().data.deleteKey(key);

export const getPortForwardings = () =>
  getBridgeBackend().data.getPortForwardings();
export const addPortForwarding = (portForwarding: Omit<PortForwarding, "id">) =>
  getBridgeBackend().data.addPortForwarding(portForwarding);
export const updatePortForwarding = (portForwarding: PortForwarding) =>
  getBridgeBackend().data.updatePortForwarding(portForwarding);
export const deletePortForwarding = (portForwarding: PortForwarding) =>
  getBridgeBackend().data.deletePortForwarding(portForwarding);
