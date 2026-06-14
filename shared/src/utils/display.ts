const AVATAR_COLORS = [
  "var(--blue-9)",
  "var(--green-9)",
  "var(--amber-9)",
  "var(--violet-9)",
  "var(--red-9)",
];

export function getAvatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export function getAvatarLabel(name: string) {
  const words = name
    .split(/[\s-_:/.]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export type TagTone = "Prod" | "Staging" | "Local" | "Accent";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "--";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function getTagTone(value: string | undefined): TagTone {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized.includes("prod")) {
    return "Prod";
  }
  if (normalized.includes("stag")) {
    return "Staging";
  }
  if (normalized.includes("local")) {
    return "Local";
  }
  return "Accent";
}
