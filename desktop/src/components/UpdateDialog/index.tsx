import {
  Badge,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  Progress,
  Text,
} from "@radix-ui/themes";
import dayjs from "dayjs";
import { useMemo } from "react";

import { useUpdateAtom } from "@/atom/updateAtom";
import styles from "./index.module.less";

type UpdateInfoLike = Record<string, unknown>;

export default function UpdateDialog() {
  const {
    openUpdateDialog,
    setOpenUpdateDialog,
    update,
    isDownloading,
    error,
    total,
    downloaded,
    download,
    install,
  } = useUpdateAtom();

  const progress = useMemo(() => {
    if (!total) {
      return 0;
    }

    return Math.min(Math.floor(((downloaded || 0) / total) * 100), 100);
  }, [total, downloaded]);

  const isDownloadSuccess = progress === 100 && !error;
  const shouldShowProgress = isDownloading || progress > 0 || !!error;
  const info = update as unknown as UpdateInfoLike | null;

  const nextVersion = useMemo(() => {
    const value = info?.version;
    return typeof value === "string" && value.trim() ? value.trim() : "--";
  }, [info]);

  const currentVersion = useMemo(() => {
    const value = info?.currentVersion;
    return typeof value === "string" && value.trim() ? value.trim() : "--";
  }, [info]);

  const publishedAt = useMemo(() => {
    const rawValue = info?.date ?? info?.pubDate;

    if (typeof rawValue === "string") {
      const parsed = dayjs(rawValue);

      if (parsed.isValid()) {
        return parsed.format("YYYY-MM-DD HH:mm:ss");
      }
    }

    return "--";
  }, [info]);

  const releaseNotes = useMemo(() => {
    const rawValue = info?.body ?? info?.notes ?? info?.releaseNotes;
    if (typeof rawValue !== "string") {
      return "No release notes available for this update.";
    }

    const value = rawValue.trim();
    return value || "No release notes available for this update.";
  }, [info]);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let index = 0;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }

    const fixed =
      value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1);
    return `${fixed} ${units[index]}`;
  };

  const downloadedText = `${formatBytes(downloaded)} / ${formatBytes(total)}`;
  const progressLabel = isDownloadSuccess
    ? "Download completed"
    : isDownloading
      ? "Downloading update package"
      : error
        ? "Download failed"
        : "Ready to download";
  const badgeColor = isDownloadSuccess
    ? "green"
    : error
      ? "red"
      : isDownloading
        ? "blue"
        : "amber";

  return (
    <Dialog.Root open={openUpdateDialog}>
      <Dialog.Content>
        <Flex direction="column" gap="4">
          <Flex
            className={styles.titleRow}
            align="center"
            justify="between"
            gap="3"
          >
            <Dialog.Title>
              {isDownloadSuccess ? "Update Ready" : "New Version Available"}
            </Dialog.Title>
            <Badge color={badgeColor} variant="soft" radius="full">
              {isDownloadSuccess
                ? "Ready"
                : error
                  ? "Failed"
                  : isDownloading
                    ? "Downloading"
                    : "Available"}
            </Badge>
          </Flex>
          <Dialog.Description>
            {isDownloadSuccess
              ? 'The update package is ready. Click "Install" to apply changes.'
              : "A newer build is available. Download now for the latest improvements."}
          </Dialog.Description>

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray" className={styles.sectionTitle}>
                Version details
              </Text>
              <div className={styles.infoGrid}>
                <Flex direction="column" gap="1" className={styles.infoItem}>
                  <Text size="1" color="gray">
                    Current
                  </Text>
                  <Text size="2" weight="medium" className={styles.metaText}>
                    {currentVersion}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1" className={styles.infoItem}>
                  <Text size="1" color="gray">
                    Latest
                  </Text>
                  <Text size="2" weight="medium" className={styles.metaText}>
                    {nextVersion}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1" className={styles.infoItem}>
                  <Text size="1" color="gray">
                    Published
                  </Text>
                  <Text size="2" weight="medium" className={styles.metaText}>
                    {publishedAt}
                  </Text>
                </Flex>
              </div>
            </Flex>
          </Card>

          {shouldShowProgress && (
            <Card variant="surface">
              <Flex direction="column" gap="2">
                <Text size="1" color="gray" className={styles.sectionTitle}>
                  Download progress
                </Text>
                <Flex
                  align="center"
                  justify="between"
                  className={styles.metaText}
                >
                  <Text size="1" color="gray">
                    {progressLabel}
                  </Text>
                  <Text size="1" weight="medium" className={styles.metaText}>
                    {progress}%
                  </Text>
                </Flex>
                <Progress value={progress} max={100} />
                <Text size="1" color="gray" className={styles.metaText}>
                  {downloadedText}
                </Text>
              </Flex>
            </Card>
          )}

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray" className={styles.sectionTitle}>
                Release notes
              </Text>
              <div className={styles.notesBox}>{releaseNotes}</div>
            </Flex>
          </Card>

          {!!error && (
            <Callout.Root color="red" role="alert">
              <Callout.Text className={styles.errorText}>
                {String(error)}
              </Callout.Text>
            </Callout.Root>
          )}

          <Flex className={styles.actionRow} justify="end" gap="3" pt="1">
            <Button
              variant="outline"
              disabled={isDownloading}
              onClick={() => setOpenUpdateDialog(false)}
            >
              Cancel
            </Button>
            {isDownloadSuccess ? (
              <Button onClick={install}>Install</Button>
            ) : (
              <Button disabled={isDownloading} onClick={download}>
                Download
              </Button>
            )}
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
