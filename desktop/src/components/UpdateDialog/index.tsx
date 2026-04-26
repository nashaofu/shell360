import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  Grid,
  Progress,
  Text,
} from "@radix-ui/themes";
import dayjs from "dayjs";
import { useMemo } from "react";

import { useUpdateAtom } from "@/atoms/update.atom";
import styles from "./index.module.less";

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

  const nextVersion = useMemo(() => {
    const value = update?.version;
    return value?.trim() ? value.trim() : "--";
  }, [update]);

  const currentVersion = useMemo(() => {
    const value = update?.currentVersion;
    return value?.trim() ? value.trim() : "--";
  }, [update]);

  const publishedAt = useMemo(() => {
    const rawValue = update?.date;

    if (typeof rawValue === "string") {
      const parsed = dayjs(rawValue);

      if (parsed.isValid()) {
        return parsed.format("YYYY-MM-DD HH:mm:ss");
      }
    }

    return "--";
  }, [update]);

  const releaseNotes = useMemo(() => {
    const value = update?.body?.trim();
    return value || "No release notes available for this update.";
  }, [update]);

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
          <Flex align="center" justify="between" gap="3">
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
              <Text size="1" color="gray">
                Version details
              </Text>
              <Grid columns={{ initial: "1", sm: "3" }} gap="2">
                <Box
                  p="3"
                  style={{
                    background: "var(--gray-a2)",
                    borderRadius: "var(--radius-3)",
                  }}
                >
                  <Text size="1" color="gray">
                    Current
                  </Text>
                  <Text as="p" size="2" weight="medium">
                    {currentVersion}
                  </Text>
                </Box>
                <Box
                  p="3"
                  style={{
                    background: "var(--gray-a2)",
                    borderRadius: "var(--radius-3)",
                  }}
                >
                  <Text size="1" color="gray">
                    Latest
                  </Text>
                  <Text as="p" size="2" weight="medium">
                    {nextVersion}
                  </Text>
                </Box>
                <Box
                  p="3"
                  style={{
                    background: "var(--gray-a2)",
                    borderRadius: "var(--radius-3)",
                  }}
                >
                  <Text size="1" color="gray">
                    Published
                  </Text>
                  <Text as="p" size="2" weight="medium">
                    {publishedAt}
                  </Text>
                </Box>
              </Grid>
            </Flex>
          </Card>

          {shouldShowProgress && (
            <Card variant="surface">
              <Flex direction="column" gap="2">
                <Text size="1" color="gray">
                  Download progress
                </Text>
                <Flex align="center" justify="between">
                  <Text size="1" color="gray">
                    {progressLabel}
                  </Text>
                  <Text size="1" weight="medium">
                    {progress}%
                  </Text>
                </Flex>
                <Progress value={progress} max={100} />
                <Text size="1" color="gray">
                  {downloadedText}
                </Text>
              </Flex>
            </Card>
          )}

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Release notes
              </Text>
              <div className={styles.notesBox}>{releaseNotes}</div>
            </Flex>
          </Card>

          {!!error && (
            <Callout.Root color="red" role="alert">
              <Callout.Text style={{ wordBreak: "break-word" }}>
                {String(error)}
              </Callout.Text>
            </Callout.Root>
          )}

          <Flex justify="end" gap="3" pt="1" wrap="wrap">
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
