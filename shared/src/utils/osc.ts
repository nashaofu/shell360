import { Buffer } from "buffer";

const OSCPrefix = Buffer.from("\x1b]");
const OSCSuffixes = [Buffer.from("\x07"), Buffer.from("\x1b\\")];

interface OscParseOpts {
  onCopy?: (content: string) => void;
}

export function oscParse(data: Buffer, { onCopy }: OscParseOpts = {}): void {
  let startIndex = 0;
  while (data.includes(OSCPrefix, startIndex)) {
    const si = startIndex;
    if (!OSCSuffixes.some((s) => data.includes(s, si))) {
      break;
    }

    const params = data.subarray(
      data.indexOf(OSCPrefix, startIndex) + OSCPrefix.length,
    ) as Buffer;

    const [closesSuffix, closestSuffixIndex] = OSCSuffixes.map(
      (suffix): [Buffer, number] => [suffix, params.indexOf(suffix)],
    )
      .filter(([, index]) => index !== -1)
      .sort(([, a], [, b]) => a - b)[0];

    const oscString = params.subarray(0, closestSuffixIndex).toString();

    startIndex = data.indexOf(closesSuffix, startIndex) + closesSuffix.length;

    const [oscCodeString, ...oscParams] = oscString.split(";");
    const oscCode = parseInt(oscCodeString, 10);

    if (oscCode === 52) {
      if (oscParams[0] === "c" || oscParams[0] === "") {
        const content = Buffer.from(oscParams[1], "base64");
        onCopy?.(content.toString());
      }
    }
  }
}
