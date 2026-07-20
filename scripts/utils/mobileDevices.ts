export type MobileDeviceStatus = "running" | "stopped" | "unavailable";

export type MobileDeviceKind = "device" | "simulator";

export type MobileDeviceCandidate = {
  id?: string;
  name: string;
  kind: MobileDeviceKind;
  status: MobileDeviceStatus;
  deviceType?: string;
};

export function createMobileDeviceChoices(
  devices: MobileDeviceCandidate[],
): Array<{ name: string; value: number; disabled: boolean | string }> {
  const nameTotals = new Map<string, number>();
  const nameOccurrences = new Map<string, number>();

  for (const device of devices) {
    nameTotals.set(device.name, (nameTotals.get(device.name) ?? 0) + 1);
  }

  return devices.map((device, index) => {
    const occurrence = (nameOccurrences.get(device.name) ?? 0) + 1;
    nameOccurrences.set(device.name, occurrence);
    const duplicateSuffix =
      (nameTotals.get(device.name) ?? 0) > 1 ? ` #${occurrence}` : "";
    const deviceType = device.deviceType ? ` · ${device.deviceType}` : "";

    return {
      name: `${device.name}${duplicateSuffix}${deviceType} · ${device.kind} · ${device.status}`,
      value: index,
      disabled: device.status === "unavailable" ? "Device unavailable" : false,
    };
  });
}
