import { useRequest } from "ahooks";
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useState,
} from "react";
import { sanitizeSftpFilename } from "shared";
import type { SSHSftp } from "tauri-plugin-ssh";

import type useMessage from "@/hooks/useMessage";
import { getErrorMessage, getSftpBasename } from "./messages";

type UseCreateOpts = {
  tableContainerRef: RefObject<HTMLDivElement | null>;
  message: ReturnType<typeof useMessage>;
  dirname?: string;
  sftpRef: MutableRefObject<SSHSftp | null>;
  refreshDir: () => unknown;
};

export enum CreateType {
  File = "File",
  Dir = "Dir",
}

export default function useCreate({
  tableContainerRef,
  message,
  dirname,
  sftpRef,
  refreshDir,
}: UseCreateOpts) {
  const [creatingFilename, setCreatingFilename] = useState<string>();
  const [createType, setCreateType] = useState<CreateType>();

  const { loading: createFileLoading, runAsync: createFile } = useRequest(
    async (path: string) => {
      const isExists = await sftpRef.current?.sftpExists(path);
      if (isExists) {
        throw new Error(`The path "${path}" already exists`);
      }
      await sftpRef.current?.sftpCreateFile(path);
    },
    {
      manual: true,
      onSuccess: (_, [path]) => {
        message.success({
          message: `Created file "${getSftpBasename(path)}"`,
        });
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: `Failed to create file: ${getErrorMessage(err)}`,
        }),
    },
  );

  const { loading: createDirLoading, runAsync: createDir } = useRequest(
    async (path: string) => {
      const isExists = await sftpRef.current?.sftpExists(path);
      if (isExists) {
        throw new Error(`The path "${path}" already exists`);
      }

      await sftpRef.current?.sftpCreateDir(path);
    },
    {
      manual: true,
      onSuccess: (_, [path]) => {
        message.success({
          message: `Created folder "${getSftpBasename(path)}"`,
        });
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: `Failed to create folder: ${getErrorMessage(err)}`,
        }),
    },
  );

  const onCreatingFilenameChange = useCallback((val: string) => {
    setCreatingFilename(sanitizeSftpFilename(val));
  }, []);

  const onCreate = useCallback(
    (val: CreateType, filename: string) => {
      tableContainerRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
      setCreatingFilename(filename);
      setCreateType(val);
    },
    [tableContainerRef],
  );

  const onCreateCancel = useCallback(() => {
    setCreatingFilename(undefined);
    setCreateType(undefined);
  }, []);

  const onCreateOk = useCallback(async () => {
    if (!createType || !creatingFilename) {
      return;
    }

    const filename = `${dirname}/${creatingFilename}`;
    if (createType === CreateType.File) {
      await createFile(filename);
    } else if (createType === CreateType.Dir) {
      await createDir(filename);
    }
    onCreateCancel();
  }, [
    createDir,
    createFile,
    createType,
    creatingFilename,
    dirname,
    onCreateCancel,
  ]);

  return {
    creatingFilename,
    onCreatingFilenameChange,
    createType,
    onCreate,
    onCreateCancel,
    onCreateOk,
    createLoading: createFileLoading || createDirLoading,
  };
}
