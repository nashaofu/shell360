import { healthCheck as nativeHealthCheck } from 'libentry.so';

export function healthCheck(): Promise<string> {
  return Promise.resolve(nativeHealthCheck());
}
