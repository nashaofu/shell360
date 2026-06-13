import { open, save } from "@tauri-apps/plugin-dialog";
import { useRequest } from "ahooks";
import { type MutableRefObject, useRef, useState } from "react";
import { WarningCircleIcon } from "shared";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";
import { useFileTransfersActions } from "@/atoms/terminalView.atom";
import type useMessage from "@/hooks/useMessage";
import type useModal from "@/hooks/useModal";

export type TransferInfo = {
  type: "upload" | "download";
  fileName: string;
  progress: number;
  total: number;
  speed: number;
  eta: number;
};

type UseSftpActionsOpts = {
  dirname?: string;
  message: ReturnType<typeof useMessage>;
  modal: ReturnType<typeof useModal>;
  sftpRef: MutableRefObject<SSHSftp | null>;
  refreshDir: () => unknown;
};

export default function useSftpActions({
  dirname,
  message,
  modal,
  sftpRef,
  refreshDir,
}: UseSftpActionsOpts) {
  const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
  const lastUpdateRef = useRef({ time: 0, progress: 0 });
  const { startTransfer, finishTransfer } = useFileTransfersActions();

  const { loading: uploadFileLoading, run: uploadFile } = useRequest(
    async () => {
      const file = await open({
        multiple: false,
        directory: false,
      });

      if (!file) {
        return true;
      }
      const filename = `${dirname}/${file.split(/(\/)|(\\)/).pop()}`;
      const isExists = await sftpRef.current?.sftpExists(filename);
      if (isExists) {
        const isCancel = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: "Warning",
            icon: (
              <WarningCircleIcon
                style={{ fontSize: 32, color: "var(--amber-11)" }}
              />
            ),
            content: `The file "${filename}" already exists. Continuing to upload will overwrite the corresponding file. Do you want to continue?`,
            onOk: () => resolve(false),
            onCancel: () => resolve(true),
          });
        });

        if (isCancel) {
          return true;
        }
      }

      lastUpdateRef.current = { time: performance.now(), progress: 0 };
      setTransferInfo({
        type: "upload",
        fileName: filename.split("/").pop() || "",
        progress: 0,
        total: 0,
        speed: 0,
        eta: -1,
      });

      startTransfer();
      try {
        await sftpRef.current?.sftpUploadFile({
          localFilename: file,
          remoteFilename: filename,
          onProgress: ({ progress, total }) => {
            const now = performance.now();
            const dt = Math.max(
              (now - lastUpdateRef.current.time) / 1000,
              0.001,
            );
            const db = progress - lastUpdateRef.current.progress;
            const speed = db / dt;
            const remaining = total - progress;
            const eta = speed > 0 ? remaining / speed : -1;
            lastUpdateRef.current = { time: now, progress };

            setTransferInfo({
              type: "upload",
              fileName: filename.split("/").pop() || "",
              progress,
              total,
              speed,
              eta,
            });
          },
        });
      } finally {
        finishTransfer();
        setTransferInfo(null);
      }

      return false;
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: (canceled) => {
        if (canceled) {
          return;
        }
        message.success({
          message: "upload file success",
        });
      },
      onError: (err) =>
        message.error({
          message: err.message ?? "upload file failed",
        }),
    },
  );

  const { loading: downloadFileLoading, run: downloadFile } = useRequest(
    async ({ name, path }: SSHSftpFile) => {
      const file = await save({
        defaultPath: name,
      });

      if (!file) {
        return true;
      }

      lastUpdateRef.current = { time: performance.now(), progress: 0 };
      setTransferInfo({
        type: "download",
        fileName: name,
        progress: 0,
        total: 0,
        speed: 0,
        eta: -1,
      });

      startTransfer();
      try {
        await sftpRef.current?.sftpDownloadFile({
          localFilename: file,
          remoteFilename: path,
          onProgress: ({ progress, total }) => {
            const now = performance.now();
            const dt = Math.max(
              (now - lastUpdateRef.current.time) / 1000,
              0.001,
            );
            const db = progress - lastUpdateRef.current.progress;
            const speed = db / dt;
            const remaining = total - progress;
            const eta = speed > 0 ? remaining / speed : -1;
            lastUpdateRef.current = { time: now, progress };

            setTransferInfo({
              type: "download",
              fileName: name,
              progress,
              total,
              speed,
              eta,
            });
          },
        });
      } finally {
        finishTransfer();
        setTransferInfo(null);
      }

      return false;
    },
    {
      manual: true,
      onSuccess: (canceled) => {
        if (canceled) {
          return;
        }
        message.success({
          message: "download file success",
        });
      },
      onError: (err) =>
        message.error({
          message: err.message ?? "download file failed",
        }),
    },
  );

  const { loading: removeFileLoading, run: removeFile } = useRequest(
    async ({ path }: SSHSftpFile) => {
      await sftpRef.current?.sftpRemoveFile(path);
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: () =>
        message.success({
          message: "remove file success",
        }),
      onError: (err) =>
        message.error({
          message: err.message ?? "remove file failed",
        }),
    },
  );

  const { loading: removeDirLoading, run: removeDir } = useRequest(
    async ({ path }: SSHSftpFile) => {
      await sftpRef.current?.sftpRemoveDir(path);
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: () =>
        message.success({
          message: "remove dir success",
        }),
      onError: (err) =>
        message.error({
          message: err.message ?? "remove dir failed",
        }),
    },
  );

  return {
    transferInfo,
    uploadFile,
    uploadFileLoading,
    downloadFile,
    downloadFileLoading,
    removeDir,
    removeDirLoading,
    removeFile,
    removeFileLoading,
  };
}
