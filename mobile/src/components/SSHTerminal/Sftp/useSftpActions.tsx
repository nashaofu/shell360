import { open, save } from '@tauri-apps/plugin-dialog';
import { useRequest } from 'ahooks';
import { MutableRefObject } from 'react';
import { SFTP, SFTPFile } from 'tauri-plugin-ssh';
import { Icon } from '@mui/material';

import useMessage from '@/hooks/useMessage';
import useModal from '@/hooks/useModal';

type UseSftpActionsOpts = {
  dirname?: string;
  message: ReturnType<typeof useMessage>;
  modal: ReturnType<typeof useModal>;
  sftpRef: MutableRefObject<SFTP | null>;
  refreshDir: () => unknown;
};

export default function useSftpActions({
  dirname,
  message,
  modal,
  sftpRef,
  refreshDir,
}: UseSftpActionsOpts) {
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
    async ({ name, path }: SFTPFile) => {
      const file = await save({
        defaultPath: name,
      });

      if (!file) {
        return true;
      }

      await sftpRef.current?.sftpDownloadFile({
        localFilename: file,
        remoteFilename: path,
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
    async ({ path }: SFTPFile) => {
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
    async ({ path }: SFTPFile) => {
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
