import os from "node:os";

export function getIpv4Address(): string {
  for (const addresses of Object.values(os.networkInterfaces())) {
    const address = addresses?.find(({ family }) => family === "IPv4");
    if (address) {
      return address.address;
    }
  }
  throw new Error(
    "Unable to detect a LAN IPv4 address. Pass --host explicitly.",
  );
}
