import {
  Button,
  Card,
  Flex,
  Heading,
  RadioCards,
  Spinner,
  Switch,
  Text,
} from "@radix-ui/themes";
import { getVersion } from "@tauri-apps/api/app";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type Appearance,
  FileDownloadIcon,
  FileIcon,
  FileUploadIcon,
  HostIcon,
  KeyIcon,
  UpgradeIcon,
  WarningCircleIcon,
  useAppearance,
} from "shared";
import { changeCryptoEnable } from "tauri-plugin-data";
import { cryptoIsEnableAtom } from "@/atoms/crypto.atom";
import { useUpdateAtom } from "@/atoms/update.atom";
import ChangeCryptoPassword from "@/components/ChangeCryptoPassword";
import InitCrypto from "@/components/InitCrypto";
import useExportData from "@/hooks/useExportData";
import useImportData from "@/hooks/useImportData";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import openUrl from "@/utils/openUrl";
import styles from "./index.module.less";

type SectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

type ActionRowProps = {
  icon: ReactNode;
  title: string;
  description: string;
  value?: ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "primary";
  };
  footer?: ReactNode;
};

const APPEARANCE_OPTIONS: Array<{
  value: Appearance;
  label: string;
  hint: string;
}> = [
  {
    value: "inherit",
    label: "Follow system",
    hint: "Match the device theme automatically.",
  },
  { value: "light", label: "Light", hint: "Keep surfaces bright and clear." },
  { value: "dark", label: "Dark", hint: "Reduce glare for long sessions." },
];

function SectionHeader({
  eyebrow,
  title,
  description,
}: Omit<SectionProps, "children">) {
  return (
    <div className={styles.sectionHeader}>
      <Text as="p" className={styles.sectionEyebrow}>
        {eyebrow}
      </Text>
      <Heading size="4" className={styles.sectionTitle}>
        {title}
      </Heading>
      <Text as="p" className={styles.sectionDescription}>
        {description}
      </Text>
    </div>
  );
}

function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <div className={styles.section}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <Card variant="surface">{children}</Card>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  description,
  value,
  cta,
  footer,
}: ActionRowProps) {
  return (
    <div className={styles.actionRow}>
      <Flex
        align={{ initial: "start", sm: "center" }}
        direction={{ initial: "column", sm: "row" }}
        justify="between"
        gap="4"
        className={styles.actionRowInner}
      >
        <div className={styles.actionMain}>
          <span className={styles.actionIcon}>{icon}</span>
          <div className={styles.actionText}>
            <Text as="p" className={styles.actionTitle}>
              {title}
            </Text>
            <Text as="p" className={styles.actionDescription}>
              {description}
            </Text>
          </div>
        </div>
        <div className={styles.actionMeta}>
          {value}
          {cta && (
            <Button
              size="2"
              variant={cta.tone === "primary" ? "solid" : "soft"}
              onClick={cta.onClick}
              disabled={cta.disabled}
            >
              {cta.label}
            </Button>
          )}
        </div>
      </Flex>
      {footer}
    </div>
  );
}

export default function Settings() {
  const [version, setVersion] = useState<string>();
  const [appearance, setAppearance] = useAppearance();
  const cryptoEnable = !!useAtomValue(cryptoIsEnableAtom);
  const { hasUpdate, checking, checkUpdate, setOpenUpdateDialog } =
    useUpdateAtom();
  const exportData = useExportData();
  const importData = useImportData();
  const message = useMessage();
  const modal = useModal();

  const [checkingError, setCheckingError] = useState<string>();
  const [initCryptoIsOpen, setInitCryptoIsOpen] = useState(false);
  const [changeCryptoPasswordIsOpen, setChangeCryptoPasswordIsOpen] =
    useState(false);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  const onCryptoEnableChange = useCallback((checked: boolean) => {
    if (checked) {
      setInitCryptoIsOpen(true);
      return;
    }
    changeCryptoEnable({ cryptoEnable: false });
  }, []);

  const onCheckUpdate = useCallback(async () => {
    if (hasUpdate) {
      setOpenUpdateDialog(true);
      return;
    }
    setCheckingError(undefined);
    try {
      const result = await checkUpdate();
      if (result) {
        setOpenUpdateDialog(true);
      }
    } catch (error) {
      setCheckingError(String(error));
    }
  }, [checkUpdate, hasUpdate, setOpenUpdateDialog]);

  const onExportData = useCallback(async () => {
    try {
      const ok = await exportData();
      if (!ok) {
        return;
      }
      message.success({
        message: "Export file successful",
      });
    } catch (err) {
      message.error({
        message: `Export failed: ${String(err)}`,
      });
    }
  }, [exportData, message]);

  const onImportData = useCallback(async () => {
    try {
      const result = await modal.confirm({
        title: "Warning",
        icon: (
          <WarningCircleIcon
            style={{ fontSize: 32, color: "var(--orange-9)" }}
          />
        ),
        content:
          "The import file will overwrite the same configuration, which may cause data loss. Please proceed with caution.",
        okText: "Import",
        cancelText: "Cancel",
      });
      if (!result) {
        return;
      }
    } catch {
      return;
    }

    try {
      const ok = await importData();
      if (!ok) {
        return;
      }
      message.success({
        message: "Import file successful",
      });
    } catch (err) {
      message.error({
        message: `Import failed: ${String(err)}`,
      });
    }
  }, [modal, importData, message]);

  return (
    <section className={styles.page}>
      <Flex
        className={styles.header}
        align="start"
        justify="between"
        gap="6"
      >
        <Flex className={styles.headerMain} direction="column" gap="2">
          <Text size="1" color="gray" className={styles.eyebrow}>
            Application
          </Text>
          <Heading size="6">Settings</Heading>
          <Text size="2" color="gray">
            Adjust appearance, local security, and update behavior for the
            desktop workspace.
          </Text>
        </Flex>
        <Flex className={styles.headerActions}>
          <button
            type="button"
            className={styles.versionPill}
            data-update={hasUpdate ? "true" : undefined}
            data-error={checkingError ? "true" : undefined}
            onClick={onCheckUpdate}
            title={
              checkingError
                ? checkingError
                : hasUpdate
                  ? "Update available"
                  : "Check for updates"
            }
          >
            <Text as="span" className={styles.versionPillLabel}>
              {version ?? "--"}
            </Text>
            {checkingError ? (
              <WarningCircleIcon className={styles.versionPillStatus} />
            ) : hasUpdate ? (
              <span className={styles.versionPillStatus}>
                <UpgradeIcon />
                Update
              </span>
            ) : checking ? (
              <Spinner className={styles.versionPillStatus} />
            ) : (
              <UpgradeIcon className={styles.versionPillStatus} />
            )}
          </button>
        </Flex>
      </Flex>
      <div className={styles.pageBody}>
        <div className={styles.layout}>
          <Section
            eyebrow="Appearance"
            title="Visual"
            description="Choose how the desktop app should look."
          >
            <RadioCards.Root
              columns={{ initial: "1", sm: "3" }}
              size="1"
              value={appearance}
              onValueChange={(value) => setAppearance(value as Appearance)}
              className={styles.radioCardsGroup}
            >
              {APPEARANCE_OPTIONS.map((option) => (
                <RadioCards.Item key={option.value} value={option.value}>
                  <Flex direction="column" width="100%">
                    <Text weight="bold">{option.label}</Text>
                    <Text color="gray" size="1" truncate>
                      {option.hint}
                    </Text>
                  </Flex>
                </RadioCards.Item>
              ))}
            </RadioCards.Root>
          </Section>

          <Section
            eyebrow="Security"
            title="Data protection"
            description="Manage local encryption and trusted hosts."
          >
            <ActionRow
              icon={<KeyIcon />}
              title="Local encryption"
              description="Protect saved application data on this device."
              value={
                <Switch
                  checked={cryptoEnable}
                  onCheckedChange={onCryptoEnableChange}
                />
              }
            />
            {cryptoEnable && (
              <>
                <div className={styles.actionDivider} />
                <ActionRow
                  icon={<KeyIcon />}
                  title="Change encryption password"
                  description="Update the password for encrypted local data."
                  cta={{
                    label: "Change",
                    onClick: () => setChangeCryptoPasswordIsOpen(true),
                  }}
                />
              </>
            )}
          </Section>

          <Section
            eyebrow="Data"
            title="Import and export"
            description="Transfer your configuration data between devices."
          >
            <ActionRow
              icon={<FileDownloadIcon />}
              title="Export data"
              description="Save all hosts, keys, and port forwardings to a file."
              cta={{
                label: "Export",
                onClick: onExportData,
              }}
            />
            <div className={styles.actionDivider} />
            <ActionRow
              icon={<FileUploadIcon />}
              title="Import data"
              description="Load hosts, keys, and port forwardings from a file."
              cta={{
                label: "Import",
                onClick: onImportData,
              }}
            />
          </Section>

          <Section
            eyebrow="Application"
            title="About"
            description="Project resources and links."
          >
            <ActionRow
              icon={<HostIcon />}
              title="Project repository"
              description="Open the GitHub repository."
              cta={{
                label: "Open",
                onClick: () =>
                  openUrl("https://github.com/nashaofu/shell360"),
              }}
            />
            <div className={styles.actionDivider} />
            <ActionRow
              icon={<FileIcon />}
              title="Documentation"
              description="Open the project README."
              cta={{
                label: "Read",
                onClick: () =>
                  openUrl(
                    "https://github.com/nashaofu/shell360/blob/master/README.md",
                  ),
              }}
            />
          </Section>
        </div>

        <InitCrypto
          open={initCryptoIsOpen}
          onCancel={() => setInitCryptoIsOpen(false)}
          onOk={() => setInitCryptoIsOpen(false)}
        />
        <ChangeCryptoPassword
          open={changeCryptoPasswordIsOpen}
          onCancel={() => setChangeCryptoPasswordIsOpen(false)}
          onOk={() => setChangeCryptoPasswordIsOpen(false)}
        />
      </div>
    </section>
  );
}
