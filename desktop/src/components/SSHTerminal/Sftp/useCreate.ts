import { useRequest } from "ahooks";
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from "react";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";

import type useMessage from "@/hooks/useMessage";

type UseCreateOpts = {
  tableContainerRef: RefObject<HTMLDivElement | null>;
  message: ReturnType<typeof useMessage>;
  dirname?: string;
  files?: SSHSftpFile[];
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
  files,
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
      onSuccess: () => {
        message.success({
          message: "create file success",
        });
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: err.message ?? "create file failed",
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
      onSuccess: () => {
        message.success({
          message: "create dir success",
        });
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: err.message ?? "create dir failed",
        }),
    },
  );

  const onCreatingFilenameChange = useCallback((val: string) => {
    setCreatingFilename(val.replace("/", ""));
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: files 改变时重置创建状态
  useEffect(() => {
    onCreateCancel();
  }, [files]);

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
