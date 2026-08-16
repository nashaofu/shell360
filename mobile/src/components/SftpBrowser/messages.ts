export { getSftpBasename } from "shared";

export function getErrorMessage(err: unknown, fallback = "Unknown error") {
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === "string") {
    return err || fallback;
  }
  try {
    return JSON.stringify(err) || fallback;
  } catch {
    return fallback;
  }
}

export function formatTransferCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
