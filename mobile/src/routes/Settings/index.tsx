import { Button, Card, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { getVersion } from "bridge/app";
import { hasCapability } from "bridge/capabilities";
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
  useAppearance,
  WarningCircleIcon,
} from "shared";
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
  disabled?: boolean;
};

function SettingsActionRow({
  label,
  icon,
  onClick,
  bordered = true,
  disabled,
}: SettingsActionRowProps) {
  return (
    <Flex
      align="center"
      justify="between"
      style={bordered ? { ...rowStyle, ...rowBorderStyle } : rowStyle}
    >
      <Text size="2" color={disabled ? "gray" : undefined}>
        {label}
        {disabled && " (Unavailable)"}
      </Text>
      <Button
        type="button"
        variant="ghost"
        color="gray"
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </Button>
    </Flex>
  );
}

export default function Settings() {
  const canUseFiles =
    hasCapability("fileDialog") && hasCapability("fileSystem");
  const canOpenUrl = hasCapability("openUrl");
  const [appearance, setAppearance] = useAppearance();
  const [version, setVersion] = useState<string>();
  const exportData = useExportData();
  const importData = useImportData();
  const modal = useModal();
  const message = useMessage();

  const onExportData = useCallback(async () => {
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
  }, [exportData, message]);

  const onImportData = useCallback(async () => {
    const confirmed = await modal.confirm({
      title: "Import configuration?",
      icon: (
        <WarningCircleIcon style={{ fontSize: 32, color: "var(--orange-9)" }} />
      ),
      content:
        "Imported hosts, keys, and tunnels will be added to the existing configuration.",
    });
    if (!confirmed) {
      return;
    }

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
  }, [modal, importData, message]);

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
            value={appearance}
            onValueChange={(value) =>
              setAppearance(value as "inherit" | "light" | "dark")
            }
          >
            <SegmentedControl.Item value="inherit">Auto</SegmentedControl.Item>
            <SegmentedControl.Item value="light">Light</SegmentedControl.Item>
            <SegmentedControl.Item value="dark">Dark</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>
        <SettingsActionRow
          label="Export"
          icon={<FileDownloadIcon />}
          onClick={onExportData}
          disabled={!canUseFiles}
        />
        <SettingsActionRow
          label="Import"
          icon={<FileUploadIcon />}
          onClick={onImportData}
          bordered={false}
          disabled={!canUseFiles}
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
          disabled={!canOpenUrl}
        />
        {import.meta.env.TAURI_ENV_PLATFORM === "ios" && (
          <SettingsActionRow
            label="Terms of Use"
            icon={<ArrowRightIcon />}
            onClick={() =>
              openUrl("https://www.apple.com/legal/itunes/appstore/dev/stdeula")
            }
            disabled={!canOpenUrl}
          />
        )}
        <SettingsActionRow
          label="About"
          icon={<ArrowRightIcon />}
          onClick={() => openUrl("https://nashaofu.github.io/shell360/")}
          disabled={!canOpenUrl}
        />
        <Flex align="center" justify="between" style={rowStyle}>
          <Text size="2">Version</Text>
          <Text size="2" color="gray">
            {version}
          </Text>
        </Flex>
      </Card>
    </Page>
  );
}
