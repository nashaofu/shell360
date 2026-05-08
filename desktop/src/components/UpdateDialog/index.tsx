import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useMemo } from "react";

import { useUpdateAtom } from "@/atom/updateAtom";
import styles from "./index.module.less";

export default function UpdateDialog() {
  const {
    openUpdateDialog,
    setOpenUpdateDialog,
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

  return (
    <Dialog.Root open={openUpdateDialog}>
      <Dialog.Content>
        <Dialog.Title>
          {isDownloadSuccess ? "🎉 Update Ready" : "🚀 New Version Available"}
        </Dialog.Title>
        <Dialog.Description>
          {isDownloadSuccess ? (
            <>
              The update has been downloaded successfully.
              <br />
              Click <b>"Install"</b> to apply the new version.
            </>
          ) : (
            <>
              A new version of the application is available.
              <br />
              Click <b>"Download"</b> to start the update process.
            </>
          )}
        </Dialog.Description>
        {(isDownloading || !!error) && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {!!error && <div className={styles.errorText}>{String(error)}</div>}
        <Flex gap="3" justify="end" mt="4">
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
      </Dialog.Content>
    </Dialog.Root>
  );
}
