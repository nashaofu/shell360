import {
  FingerprintIcon,
  HostIcon,
  KeyIcon,
  SettingsIcon,
  SiteMapIcon,
} from "shared";

export type PageConfig = {
  path: string;
  label: string;
  Icon: typeof HostIcon;
  section: "main" | "bottom";
};

export const PAGES: PageConfig[] = [
  { path: "/", label: "Hosts", Icon: HostIcon, section: "main" },
  {
    path: "/port-forwardings",
    label: "Tunnels",
    Icon: SiteMapIcon,
    section: "main",
  },
  { path: "/keys", label: "Keys", Icon: KeyIcon, section: "main" },
  {
    path: "/known-hosts",
    label: "Known Hosts",
    Icon: FingerprintIcon,
    section: "main",
  },
  {
    path: "/settings",
    label: "Settings",
    Icon: SettingsIcon,
    section: "bottom",
  },
];
