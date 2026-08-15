import os from "node:os";

export function getIpv4Address(): string {
  const candidates = Object.entries(os.networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? [])
        .filter(
          ({ address, family, internal }) =>
            family === "IPv4" && !internal && isPrivateIpv4(address),
        )
        .map(({ address }) => ({ address, name })),
    )
    .sort((left, right) => interfacePriority(right) - interfacePriority(left));
  const candidate = candidates[0];
  if (candidate) {
    return candidate.address;
  }
  throw new Error(
    "Unable to detect a LAN IPv4 address. Pass --host explicitly.",
  );
}

function interfacePriority({
  address,
  name,
}: {
  address: string;
  name: string;
}) {
  const isVirtual =
    /docker|mihomo|tailscale|virtual|vmnet|vmware|vethernet|wsl|zerotier/i.test(
      name,
    );
  const subnetPriority = address.startsWith("192.168.")
    ? 3
    : address.startsWith("10.")
      ? 2
      : 1;
  return (isVirtual ? 0 : 10) + subnetPriority;
}

export function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
