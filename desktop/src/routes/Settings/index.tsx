import { Box, Button, Flex, Spinner, Switch, Text } from "@radix-ui/themes";
import { getVersion } from "@tauri-apps/api/app";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { type Appearance, useAppearance } from "shared";
import { changeCryptoEnable } from "tauri-plugin-data";
import { cryptoIsEnableAtom } from "@/atom/cryptoAtom";
import { useUpdateAtom } from "@/atom/updateAtom";
import ChangeCryptoPassword from "@/components/ChangeCryptoPassword";
import IniCrypto from "@/components/InitCrypto";
import Page from "@/components/Page";
import openUrl from "@/utils/openUrl";
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
    <section className={styles.sectionCard}>
      <div className={styles.sectionIntro}>
        <Text as="p" className={styles.sectionEyebrow}>
          {eyebrow}
        </Text>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <Text as="p" className={styles.sectionDescription}>
          {description}
        </Text>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
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
    <div className={styles.actionRow}>
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
    </div>
  );
}

export default function Settings() {
  const [version, setVersion] = useState<string>();
  const [appearance, setAppearance] = useAppearance();
  const cryptoEnable = !!useAtomValue(cryptoIsEnableAtom);
  const { update, checking, checkUpdate, setOpenUpdateDialog } =
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
    setCheckingError(undefined);

    try {
      const result = await checkUpdate();
      if (result) {
        setOpenUpdateDialog(true);
      }
    } catch (error) {
      setCheckingError(String(error));
    }
  }, [checkUpdate, setOpenUpdateDialog]);

  return (
    <Page title="Settings">
      <Box className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <Text as="p" className={styles.heroEyebrow}>
              Shell360 Settings
            </Text>
            <h2 className={styles.heroTitle}>Desktop preferences</h2>
            <Text as="p" className={styles.heroDescription}>
              Adjust appearance, local security, and update behavior in one
              place.
            </Text>
          </div>
          <div className={styles.heroMeta}>
            <Text as="span" className={styles.heroMetaItem}>
              {version ?? "--"}
            </Text>
          </div>
        </section>

        <div className={styles.layout}>
          <SettingSection
            eyebrow="Appearance"
            title="Visual"
            description="Choose how the desktop app should look."
          >
            <div className={styles.themeGrid}>
              {APPEARANCE_OPTIONS.map((option) => {
                const active = option.value === appearance;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.themeOption}${active ? ` ${styles.themeOptionActive}` : ""}`}
                    onClick={() => setAppearance(option.value)}
                  >
                    <span className={styles.themeText}>
                      <span className={styles.themeLabel}>{option.label}</span>
                      <span className={styles.themeHint}>{option.hint}</span>
                    </span>
                    <span className={styles.themeState}>
                      {active ? "Current" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingSection>

          <SettingSection
            eyebrow="Security"
            title="Data protection"
            description="Manage local encryption and trusted hosts."
          >
            <div className={styles.securityPanel}>
              <div className={styles.securityHighlight}>
                <div>
                  <Text as="p" className={styles.highlightTitle}>
                    Local encryption
                  </Text>
                  <Text as="p" className={styles.highlightDescription}>
                    Protect saved application data on this device.
                  </Text>
                </div>
                <Switch
                  checked={cryptoEnable}
                  onCheckedChange={onCryptoEnableChange}
                />
              </div>

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
                  update
                    ? "A new version is available."
                    : "Look for a new release."
                }
                onClick={onCheckUpdate}
                ctaLabel={update ? "Open updater" : "Check now"}
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

              {!checking && !update && !checkingError && (
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
                onClick={() => openUrl("https://github.com/nashaofu/shell360")}
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
      </Box>

      <IniCrypto
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
  );
}
