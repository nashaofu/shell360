export type KnownHost = {
  host: string;
  id: string;
  key: string;
  lineIndex: number;
  marker?: string;
  rawLine: string;
  type: string;
};

const KNOWN_HOST_MARKERS = new Set(["@cert-authority", "@revoked"]);

export function parseKnownHosts(data: string): KnownHost[] {
  return data.split(/\r?\n/).flatMap((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return [];
    }

    const parts = line.split(/\s+/);
    const hasMarker = KNOWN_HOST_MARKERS.has(parts[0]);
    const marker = hasMarker ? parts[0] : undefined;
    const host = hasMarker ? parts[1] : parts[0];
    const type = hasMarker ? parts[2] : parts[1];
    const key = hasMarker ? parts.slice(3).join(" ") : parts.slice(2).join(" ");

    if (!host || !type || !key) {
      return [];
    }

    return [
      {
        host,
        id: rawLine,
        key,
        lineIndex,
        marker,
        rawLine,
        type,
      },
    ];
  });
}

export function removeKnownHostLine(data: string, knownHost: KnownHost) {
  return data
    .split(/\r?\n/)
    .filter((line, lineIndex) => {
      if (lineIndex === knownHost.lineIndex && line === knownHost.rawLine) {
        return false;
      }

      return line.trim() !== knownHost.rawLine.trim();
    })
    .join("\n");
}
