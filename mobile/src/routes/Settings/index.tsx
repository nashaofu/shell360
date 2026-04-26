import { Button, Card, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { getVersion } from "@tauri-apps/api/app";
import { useAtom } from "jotai";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArrowRightIcon,
  FileDownloadIcon,
  FileUploadIcon,
  WarningCircleIcon,
} from "shared";
import { useIsShowPaywallAtom, useIsSubscription } from "@/atoms/iap.atom";
import { ThemeMode, themeModeAtom } from "@/atoms/theme.atom";
import Page from "@/components/Page";
import useExportData from "@/hooks/useExportData";
import useImportData from "@/hooks/useImportData";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import openUrl from "@/utils/openUrl";

import CryptoSettings from "./CryptoSettings";

const sectionStyle: CSSProperties = {
  maxWidth: 560,
  margin: "16px auto",
};

const rowStyle: CSSProperties = {
  minHeight: 56,
  padding: "0 16px",
};

const rowBorderStyle: CSSProperties = {
  borderBottom: "1px solid var(--gray-a5)",
};

type SettingsActionRowProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  bordered?: boolean;
};

function SettingsActionRow({
  label,
  icon,
  onClick,
  bordered = true,
}: SettingsActionRowProps) {
  return (
    <Flex
      align="center"
      justify="between"
      style={bordered ? { ...rowStyle, ...rowBorderStyle } : rowStyle}
    >
      <Text size="2">{label}</Text>
      <Button type="button" variant="ghost" color="gray" onClick={onClick}>
        {icon}
      </Button>
    </Flex>
  );
}

function IOSIAP() {
  const [, setOpen] = useIsShowPaywallAtom();

  return (
    <Card size="2" style={sectionStyle}>
      <SettingsActionRow
        label="Subscription"
        icon={<ArrowRightIcon />}
        onClick={() => setOpen(true)}
        bordered={false}
      />
    </Card>
  );
}

export default function Settings() {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom);
  const [version, setVersion] = useState<string>();
  const exportData = useExportData();
  const importData = useImportData();
  const modal = useModal();
  const message = useMessage();
  const isSubscription = useIsSubscription();
  const [, setOpen] = useIsShowPaywallAtom();

  const onExportData = useCallback(async () => {
    // Export requires subscription.
    if (!isSubscription) {
      setOpen(true);
      return;
    }

    try {
      const path = await exportData();
      if (!path) {
        return;
      }
      message.success({
        message: "Export file successful",
      });
    } catch (err) {
      message.error({
        message: (
          <div style={{ wordBreak: "break-all" }}>
            Export failed:
            {` ${JSON.stringify(err)}`}
          </div>
        ),
      });
    }
  }, [exportData, isSubscription, message, setOpen]);

  const onImportData = useCallback(async () => {
    // Import requires subscription.
    if (!isSubscription) {
      setOpen(true);
      return;
    }

    await new Promise<void>((resolve) => {
      modal.confirm({
        title: "Warning",
        icon: (
          <WarningCircleIcon
            style={{ fontSize: 32, color: "var(--orange-9)" }}
          />
        ),
        content:
          "The import file will cover the same configuration, which may cause data loss, please do it carefully",
        onOk: () => resolve(),
      });
    });

    try {
      const isSuccess = await importData();
      if (!isSuccess) {
        return;
      }
      message.success({
        message: "Import file successful",
      });
    } catch (err) {
      message.error({
        message: (
          <div style={{ wordBreak: "break-all" }}>
            Import failed:
            {` ${String(err)}`}
          </div>
        ),
      });
    }
  }, [isSubscription, setOpen, modal, importData, message]);

  useEffect(() => {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }, []);

  return (
    <Page title="Settings">
      <Card size="2" style={sectionStyle}>
        <Flex
          align="center"
          justify="between"
          style={{ ...rowStyle, ...rowBorderStyle }}
        >
          <Text size="2">Theme Mode</Text>
          <SegmentedControl.Root
            value={themeMode}
            onValueChange={(value) => setThemeMode(value as ThemeMode)}
          >
            <SegmentedControl.Item value={ThemeMode.Auto}>
              Auto
            </SegmentedControl.Item>
            <SegmentedControl.Item value={ThemeMode.Light}>
              Light
            </SegmentedControl.Item>
            <SegmentedControl.Item value={ThemeMode.Dark}>
              Dark
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>
        <SettingsActionRow
          label="Export"
          icon={<FileDownloadIcon />}
          onClick={onExportData}
        />
        <SettingsActionRow
          label="Import"
          icon={<FileUploadIcon />}
          onClick={onImportData}
          bordered={false}
        />
      </Card>

      <Card size="2" style={sectionStyle}>
        <CryptoSettings />
      </Card>

      <Card size="2" style={sectionStyle}>
        <SettingsActionRow
          label="Privacy Policy"
          icon={<ArrowRightIcon />}
          onClick={() =>
            openUrl(
              "https://nashaofu.github.io/shell360/docs/Privacy-Policy.html",
            )
          }
        />
        {import.meta.env.TAURI_ENV_PLATFORM === "ios" && (
          <SettingsActionRow
            label="Terms of Use"
            icon={<ArrowRightIcon />}
            onClick={() =>
              openUrl("http://www.apple.com/legal/itunes/appstore/dev/stdeula")
            }
          />
        )}
        <SettingsActionRow
          label="About"
          icon={<ArrowRightIcon />}
          onClick={() => openUrl("https://nashaofu.github.io/shell360/")}
        />
        <Flex align="center" justify="between" style={rowStyle}>
          <Text size="2">Version</Text>
          <Text size="2" color="gray">
            {version}
          </Text>
        </Flex>
      </Card>

      {import.meta.env.TAURI_ENV_PLATFORM === "ios" && <IOSIAP />}
    </Page>
  );
}
