import { open, save } from '@tauri-apps/plugin-dialog';
import { useRequest } from 'ahooks';
import { MutableRefObject, useState } from 'react';
import { SSHSftp, SSHSftpFile } from 'tauri-plugin-ssh';
import { Icon } from '@mui/material';

import useMessage from '@/hooks/useMessage';
import useModal from '@/hooks/useModal';

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
  const [progress, setProgress] = useState(0);

  const { loading: uploadFileLoading, run: uploadFile } = useRequest(
    async () => {
      const file = await open({
        multiple: false,
        directory: false,
      });

      if (!file) {
        return true;
      }
      const filename = dirname + '/' + file.split(/(\/)|(\\)/).pop();
      const isExists = await sftpRef.current?.sftpExists(filename);
      if (isExists) {
        const isCancel = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: 'Warning',
            icon: (
              <Icon
                color="warning"
                sx={{ fontSize: 32 }}
                className="icon-warning-circle"
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
      await sftpRef.current?.sftpUploadFile({
        localFilename: file,
        remoteFilename: filename,
        onProgress: ({ progress, total }) => {
          setProgress(Math.round((progress / total) * 100));
        },
      });

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
          message: 'upload file success',
        });
      },
      onError: (err) =>
        message.error({
          message: err.message ?? 'upload file failed',
        }),
    }
  );

  const { loading: downloadFileLoading, run: downloadFile } = useRequest(
    async ({ name, path }: SSHSftpFile) => {
      const file = await save({
        defaultPath: name,
      });

      if (!file) {
        return true;
      }

      await sftpRef.current?.sftpDownloadFile({
        localFilename: file,
        remoteFilename: path,
        onProgress: ({ progress, total }) => {
          setProgress(Math.round((progress / total) * 100));
        },
      });

      return false;
    },
    {
      manual: true,
      onSuccess: (canceled) => {
        if (canceled) {
          return;
        }
        message.success({
          message: 'download file success',
        });
      },
      onError: (err) =>
        message.error({
          message: err.message ?? 'download file failed',
        }),
    }
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
          message: 'remove file success',
        }),
      onError: (err) =>
        message.error({
          message: err.message ?? 'remove file failed',
        }),
    }
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
          message: 'remove dir success',
        }),
      onError: (err) =>
        message.error({
          message: err.message ?? 'remove dir failed',
        }),
    }
  );

  return {
    progress,
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
