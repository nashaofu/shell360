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
import { type Appearance, useAppearance } from "shared";
import { changeCryptoEnable } from "tauri-plugin-data";
import { cryptoIsEnableAtom } from "@/atoms/crypto";
import { useUpdateAtom } from "@/atoms/update";
import ChangeCryptoPassword from "@/components/ChangeCryptoPassword";
import InitCrypto from "@/components/InitCrypto";
import openUrl from "@/utils/openUrl";
import Page from "@/components/Page";
import styles from "./index.module.less";

type SettingSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

type SettingActionProps = {
  icon: string;
  title: string;
  description: string;
  value?: string;
  onClick?: () => void;
  ctaLabel?: string;
  disabled?: boolean;
  tone?: "default" | "primary";
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
  {
    value: "light",
    label: "Light",
    hint: "Keep surfaces bright and clear.",
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Reduce glare for long sessions.",
  },
];

function SettingSection({
  eyebrow,
  title,
  description,
  children,
}: SettingSectionProps) {
  return (
    <Card variant="surface">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="2">
          <Text as="p" className={styles.sectionEyebrow}>
            {eyebrow}
          </Text>
          <Heading size="4" className={styles.sectionTitle}>
            {title}
          </Heading>
          <Text as="p" className={styles.sectionDescription}>
            {description}
          </Text>
        </Flex>
        <Flex direction="column" gap="3">
          {children}
        </Flex>
      </Flex>
    </Card>
  );
}

function SettingAction({
  icon,
  title,
  description,
  value,
  onClick,
  ctaLabel = "Open",
  disabled,
  tone = "default",
}: SettingActionProps) {
  return (
    <Card variant="surface">
      <Flex
        align={{ initial: "start", sm: "center" }}
        direction={{ initial: "column", sm: "row" }}
        justify="between"
        gap="4"
      >
        <div className={styles.actionMain}>
          <span className={`${styles.actionIcon} ${icon}`} />
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
          {value && (
            <Text as="span" className={styles.actionValue}>
              {value}
            </Text>
          )}
          {onClick && (
            <Button
              size="2"
              variant={tone === "primary" ? "solid" : "soft"}
              onClick={onClick}
              disabled={disabled}
            >
              {ctaLabel}
            </Button>
          )}
        </div>
      </Flex>
    </Card>
  );
}

export default function Settings() {
  const [version, setVersion] = useState<string>();
  const [appearance, setAppearance] = useAppearance();
  const cryptoEnable = !!useAtomValue(cryptoIsEnableAtom);
  const { hasUpdate, checking, checkUpdate, setOpenUpdateDialog } =
    useUpdateAtom();

  const [checkingError, setCheckingError] = useState<string>();
  const [initCryptoIsOpen, setInitCryptoIsOpen] = useState(false);
  const [changeCryptoPasswordIsOpen, setChangeCryptoPasswordIsOpen] =
    useState(false);

  useEffect(() => {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }, []);

  const onCryptoEnableChange = useCallback((checked: boolean) => {
    if (checked) {
      setInitCryptoIsOpen(true);
      return;
    }

    changeCryptoEnable({
      cryptoEnable: false,
    });
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

  return (
    <div className={styles.pageWrap}>
      <Page
        eyebrow="Application"
        title="Settings"
        description="Adjust appearance, local security, and update behavior for the desktop workspace."
        actions={
          <Text as="span" className={styles.versionChip}>
            {version ?? "--"}
          </Text>
        }
      >
        <div className={styles.container}>
          <div className={styles.layout}>
            <SettingSection
              eyebrow="Appearance"
              title="Visual"
              description="Choose how the desktop app should look."
            >
              <RadioCards.Root
                columns={{ initial: "1", sm: "3" }}
                size="1"
                value={appearance}
                onValueChange={(value) => setAppearance(value as Appearance)}
              >
                {APPEARANCE_OPTIONS.map((option) => {
                  return (
                    <RadioCards.Item key={option.value} value={option.value}>
                      <Flex direction="column" width="100%">
                        <Text weight="bold">{option.label}</Text>
                        <Text color="gray" size="1" truncate>
                          {option.hint}
                        </Text>
                      </Flex>
                    </RadioCards.Item>
                  );
                })}
              </RadioCards.Root>
            </SettingSection>

            <SettingSection
              eyebrow="Security"
              title="Data protection"
              description="Manage local encryption and trusted hosts."
            >
              <div className={styles.securityPanel}>
                <Card variant="surface">
                  <Flex
                    align={{ initial: "start", sm: "center" }}
                    direction={{ initial: "column", sm: "row" }}
                    justify="between"
                    gap="4"
                  >
                    <Flex direction="column" gap="1">
                      <Text as="p" className={styles.highlightTitle}>
                        Local encryption
                      </Text>
                      <Text as="p" className={styles.highlightDescription}>
                        Protect saved application data on this device.
                      </Text>
                    </Flex>
                    <Switch
                      checked={cryptoEnable}
                      onCheckedChange={onCryptoEnableChange}
                    />
                  </Flex>
                </Card>

                {cryptoEnable && (
                  <SettingAction
                    icon="icon-key"
                    title="Change encryption password"
                    description="Update the password for encrypted local data."
                    onClick={() => setChangeCryptoPasswordIsOpen(true)}
                    ctaLabel="Change"
                  />
                )}
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Application"
              title="Updates and support"
              description="Low-frequency actions and app information."
            >
              <div className={styles.stackGroup}>
                <SettingAction
                  icon="icon-label"
                  title="Check for updates"
                  description={
                    hasUpdate
                      ? "A new version is available."
                      : "Look for a new release."
                  }
                  onClick={onCheckUpdate}
                  ctaLabel={hasUpdate ? "Open updater" : "Check now"}
                  value={checking ? "Checking..." : undefined}
                  disabled={!!checking}
                  tone="primary"
                />

                {checking && (
                  <Flex align="center" gap="2" className={styles.inlineNotice}>
                    <Spinner size="2" />
                    <Text as="span">Checking the latest version...</Text>
                  </Flex>
                )}

                {!checking && !hasUpdate && !checkingError && (
                  <Text as="p" className={styles.inlineNotice}>
                    No update is currently detected.
                  </Text>
                )}

                {!!checkingError && (
                  <Text as="p" className={styles.inlineNoticeError}>
                    {checkingError}
                  </Text>
                )}
                <SettingAction
                  icon="icon-host"
                  title="Project repository"
                  description="Open the GitHub repository."
                  onClick={() =>
                    openUrl("https://github.com/nashaofu/shell360")
                  }
                  ctaLabel="Open"
                />
                <SettingAction
                  icon="icon-file"
                  title="Documentation"
                  description="Open the project README."
                  onClick={() =>
                    openUrl(
                      "https://github.com/nashaofu/shell360/blob/master/README.md",
                    )
                  }
                  ctaLabel="Read"
                />
              </div>
            </SettingSection>
          </div>
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
      </Page>
    </div>
  );
}
