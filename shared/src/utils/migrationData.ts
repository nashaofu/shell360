import {
  AuthenticationMethod,
  type Host,
  type Key,
  type PortForwarding,
  PortForwardingType,
} from 'tauri-plugin-data';

enum OldAuthMethod {
  Password = 'Password',
  Key = 'Key',
}

const AUTH_METHOD_MAP = {
  [OldAuthMethod.Password]: AuthenticationMethod.Password,
  [OldAuthMethod.Key]: AuthenticationMethod.PublicKey,
};

type OldHost = {
  uuid: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authMethod: OldAuthMethod;
  password?: string;
  key?: string;
  fontFamily: string;
  fontSize: number;
  theme: string;
};

type OldKey = {
  uuid: string;
  name: string;
  privateKey: string;
  publicKey?: string;
  passphrase?: string;
};

enum OldPortForwardingType {
  Local = 'Local',
  Remote = 'Remote',
  Dynamic = 'Dynamic',
}

const PORT_FORWARDING_TYPE_MAP = {
  [OldPortForwardingType.Local]: PortForwardingType.Local,
  [OldPortForwardingType.Remote]: PortForwardingType.Remote,
  [OldPortForwardingType.Dynamic]: PortForwardingType.Dynamic,
};

type OldPortForwarding = {
  uuid: string;
  type: OldPortForwardingType;
  name: string;
  // 对应 host 的uuid
  host: string;
  localAddress: string;
  localPort: number;
  remoteAddress?: string;
  remotePort?: number;
};

function tryGetFromLocalStorage<T>(key: string): T[] {
  const str = localStorage.getItem(key);
  try {
    const data = JSON.parse(str || '');
    if (!Array.isArray(data)) {
      throw new Error(`localStorage ${key} is not array`);
    }
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
    return [];
  }
}

export function migrationData() {
  const oldHosts = tryGetFromLocalStorage<OldHost>('hosts');
  const oldKeys = tryGetFromLocalStorage<OldKey>('keys');
  const oldPortForwardings =
    tryGetFromLocalStorage<OldPortForwarding>('port-forwarding');

  const hosts: Host[] = oldHosts.map((item) => {
    return {
      id: item.uuid,
      name: item.name,
      hostname: item.hostname,
      port: item.port,
      username: item.username,
      authenticationMethod: AUTH_METHOD_MAP[item.authMethod],
      password: item.password,
      keyId: item.key,
      terminalSettings: {
        fontFamily: item.fontFamily,
        fontSize: item.fontSize,
        theme: item.theme,
      },
    };
  });

  const keys: Key[] = oldKeys.map<Key>((item) => {
    return {
      id: item.uuid,
      name: item.name,
      privateKey: item.privateKey || '',
      publicKey: item.publicKey || '',
      passphrase: item.passphrase,
    };
  });

  const portForwardings: PortForwarding[] = oldPortForwardings?.map((item) => {
    return {
      id: item.uuid,
      name: item.name,
      portForwardingType: PORT_FORWARDING_TYPE_MAP[item.type],
      hostId: item.host,
      localAddress: item.localAddress,
      localPort: item.localPort,
      remoteAddress: item.remoteAddress,
      remotePort: item.remotePort,
    };
  });

  const data = JSON.stringify({
    hosts,
    keys,
    portForwardings,
  });

  return data;
}
