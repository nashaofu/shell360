import { SegmentedControl, Text } from "@radix-ui/themes";
import { getVersion } from "bridge/app";
import { hasCapability } from "bridge/capabilities";
import { type ReactNode, useCallback, useEffect, useState } from "react";
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
import styles from "./index.module.less";

type SettingsRowProps = {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  rightText?: string;
  children?: ReactNode;
};

function SettingsRow({
  label,
  icon,
  onClick,
  disabled,
  rightText,
  children,
}: SettingsRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {label}
        {disabled && (
          <Text size="1" color="gray">
            {" "}
            (Unavailable)
          </Text>
        )}
      </span>
      {rightText && <span className={styles.rowValue}>{rightText}</span>}
      {icon && (
        <button
          type="button"
          className={styles.rowAction}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </button>
      )}
      {children}
    </div>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>;
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
      <div className={styles.section}>
        <p className={styles.sectionHeader}>Appearance</p>
        <SettingsGroup>
          <div
            className={styles.row}
            style={{ paddingTop: 8, paddingBottom: 8 }}
          >
            <span className={styles.rowLabel}>Theme Mode</span>
            <SegmentedControl.Root
              value={appearance}
              onValueChange={(value) =>
                setAppearance(value as "inherit" | "light" | "dark")
              }
              size="1"
            >
              <SegmentedControl.Item value="inherit">
                Auto
              </SegmentedControl.Item>
              <SegmentedControl.Item value="light">Light</SegmentedControl.Item>
              <SegmentedControl.Item value="dark">Dark</SegmentedControl.Item>
            </SegmentedControl.Root>
          </div>
        </SettingsGroup>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionHeader}>Data</p>
        <SettingsGroup>
          <SettingsRow
            label="Export"
            icon={<FileDownloadIcon />}
            onClick={() => void onExportData()}
            disabled={!canUseFiles}
          />
          <SettingsRow
            label="Import"
            icon={<FileUploadIcon />}
            onClick={() => void onImportData()}
            disabled={!canUseFiles}
          />
        </SettingsGroup>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionHeader}>Security</p>
        <SettingsGroup>
          <CryptoSettings />
        </SettingsGroup>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionHeader}>About</p>
        <SettingsGroup>
          <SettingsRow
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
            <SettingsRow
              label="Terms of Use"
              icon={<ArrowRightIcon />}
              onClick={() =>
                openUrl(
                  "https://www.apple.com/legal/itunes/appstore/dev/stdeula",
                )
              }
              disabled={!canOpenUrl}
            />
          )}
          <SettingsRow
            label="About"
            icon={<ArrowRightIcon />}
            onClick={() => openUrl("https://nashaofu.github.io/shell360/")}
            disabled={!canOpenUrl}
          />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Version</span>
            <span className={styles.rowValue}>{version}</span>
          </div>
        </SettingsGroup>
      </div>
    </Page>
  );
}
