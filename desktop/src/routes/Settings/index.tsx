import { getVersion } from "@tauri-apps/api/app";
import styles from "./index.module.less";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { modeAtom, ThemeMode } from "@/atom/themeAtom";
import { useUpdateAtom } from "@/atom/updateAtom";
import Page from "@/components/Page";
import useExportData from "@/hooks/useExportData";
import useImportData from "@/hooks/useImportData";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import openUrl from "@/utils/openUrl";

import CryptoSettings from "./CryptoSettings";

export default function Settings() {
  const [themeMode, setThemeMode] = useAtom(modeAtom);

  const { checkUpdate, setOpenUpdateDialog } = useUpdateAtom();
  const [version, setVersion] = useState<string>();
  const exportData = useExportData();
  const importData = useImportData();
  const modal = useModal();
  const message = useMessage();

  const onCheckUpdate = useCallback(async () => {
    const update = await checkUpdate();
    if (update?.available) {
      setOpenUpdateDialog(true);
    }
  }, [checkUpdate, setOpenUpdateDialog]);

  const onExportData = useCallback(async () => {
    try {
      const path = await exportData();
      if (!path) {
        return;
      }
      message.success({
        message: "Export file successful",
      });
    } catch (err) {
      message.error({
        message: (
          <span style={{ wordBreak: "break-all" }}>
            Export failed:
            {` ${JSON.stringify(err)}`}
          </span>
        ),
      });
    }
  }, [exportData, message]);

  const onImportData = useCallback(async () => {
    await new Promise<void>((resolve) => {
      modal.confirm({
        title: "Warning",
        icon: (
          <span
            className="icon-warning-circle"
            style={{ fontSize: 32, color: "var(--orange-9)" }}
          />
        ),
        content:
          "The import file will cover the same configuration, which may cause data loss, please do it carefully",
        onOk: () => resolve(),
      });
    });

    try {
      const isSuccess = await importData();
      if (!isSuccess) {
        return;
      }
      message.success({
        message: "Import file successful",
      });
    } catch (err) {
      message.error({
        message: (
          <span style={{ wordBreak: "break-all" }}>
            Import failed:
            {` ${String(err)}`}
          </span>
        ),
      });
    }
  }, [importData, modal, message]);

  useEffect(() => {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }, []);

  return (
    <Page title="Settings">
      <div className={styles.paper}>
        <ul className={styles.list}>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>Theme Mode</span>
            <div className={styles.themeGroup}>
              {([ThemeMode.Auto, ThemeMode.Light, ThemeMode.Dark] as const).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles.themeBtn}${themeMode === mode ? ` ${styles.active}` : ""}`}
                    onClick={() => setThemeMode(mode)}
                  >
                    <span
                      className={
                        mode === ThemeMode.Auto
                          ? "icon-settings-brightness"
                          : mode === ThemeMode.Light
                            ? "icon-light-mode"
                            : "icon-dark-mode"
                      }
                    />
                    {mode === ThemeMode.Auto
                      ? "Auto"
                      : mode === ThemeMode.Light
                        ? "Light"
                        : "Dark"}
                  </button>
                ),
              )}
            </div>
          </li>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>Export</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onExportData}
            >
              <span className="icon-file-download" />
            </button>
          </li>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>Import</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onImportData}
            >
              <span className="icon-file-upload" />
            </button>
          </li>
        </ul>
      </div>

      <div className={styles.paper}>
        <CryptoSettings />
      </div>

      <div className={styles.paper}>
        <ul className={styles.list}>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>Check Update</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onCheckUpdate}
            >
              <span className="icon-arrow-right" />
            </button>
          </li>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>Privacy Policy</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() =>
                openUrl(
                  "https://nashaofu.github.io/shell360/docs/Privacy-Policy.html",
                )
              }
            >
              <span className="icon-arrow-right" />
            </button>
          </li>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>About</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => openUrl("https://nashaofu.github.io/shell360/")}
            >
              <span className="icon-arrow-right" />
            </button>
          </li>
          <li className={styles.listItem}>
            <span className={styles.listItemText}>Version</span>
            {version}
          </li>
        </ul>
      </div>
    </Page>
  );
}
