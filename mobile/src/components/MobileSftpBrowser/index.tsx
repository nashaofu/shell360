import type { ComponentProps } from "react";
import { SftpBrowser } from "shared";

export default function MobileSftpBrowser(
  props: ComponentProps<typeof SftpBrowser>,
) {
  return <SftpBrowser {...props} className="mobile-sftp-browser" />;
}
