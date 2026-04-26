import type { Env } from "tauri-plugin-data";

export function parseEnvs(value: string | undefined): Env[] {
  if (!value) {
    return [];
  }
  return value.split(",").reduce<Env[]>((envs, entry) => {
    const eqIdx = entry.indexOf("=");
    if (eqIdx === -1) {
      return envs;
    }
    const key = entry.slice(0, eqIdx).trim();
    const value = entry.slice(eqIdx + 1).trim();
    if (!key || !value) {
      return envs;
    }
    envs.push({ key, value });
    return envs;
  }, []);
}

export function stringifyEnvs(envs: Env[] | undefined): string {
  return envs?.map((env) => `${env.key}=${env.value}`).join(",") ?? "";
}

export function validateEnvs(value: string | undefined): true | string {
  if (!value) {
    return true;
  }
  for (const entry of value.split(",")) {
    const eqIdx = entry.indexOf("=");
    if (eqIdx === -1) {
      return "Invalid environment variable format";
    }
    const key = entry.slice(0, eqIdx).trim();
    const envValue = entry.slice(eqIdx + 1).trim();
    if (!key || !envValue) {
      return "Invalid environment variable format";
    }
  }
  return true;
}
