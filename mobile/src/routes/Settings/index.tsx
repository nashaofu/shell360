import { SegmentedControl } from "@radix-ui/themes";
import { getVersion } from "@tauri-apps/api/app";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useIsShowPaywallAtom, useIsSubscription } from "@/atom/iap";
import { ThemeMode, themeModeAtom } from "@/atom/themeAtom";
import Page from "@/components/Page";
import useExportData from "@/hooks/useExportData";
import useImportData from "@/hooks/useImportData";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import openUrl from "@/utils/openUrl";

import CryptoSettings from "./CryptoSettings";

function IOSIAP() {
  const [, setOpen] = useIsShowPaywallAtom();

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "16px auto",
        border: "1px solid var(--gray-a5)",
        borderRadius: "var(--radius-4)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 56,
          padding: "0 16px",
        }}
      >
        <span>Subscription</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          <span className="icon-arrow-right" />
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom);
  const [version, setVersion] = useState<string>();
  const exportData = useExportData();
  const importData = useImportData();
  const modal = useModal();
  const message = useMessage();
  const isSubscription = useIsSubscription();
  const [, setOpen] = useIsShowPaywallAtom();

  const onExportData = useCallback(async () => {
    // Export requires subscription.
    if (!isSubscription) {
      setOpen(true);
      return;
    }

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
          <div style={{ wordBreak: "break-all" }}>
            Export failed:
            {` ${JSON.stringify(err)}`}
          </div>
        ),
      });
    }
  }, [exportData, isSubscription, message, setOpen]);

  const onImportData = useCallback(async () => {
    // Import requires subscription.
    if (!isSubscription) {
      setOpen(true);
      return;
    }

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
          <div style={{ wordBreak: "break-all" }}>
            Import failed:
            {` ${String(err)}`}
          </div>
        ),
      });
    }
  }, [isSubscription, setOpen, modal, importData, message]);

  useEffect(() => {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }, []);

  return (
    <Page title="Settings">
      <div
        style={{
          maxWidth: 560,
          margin: "16px auto",
          border: "1px solid var(--gray-a5)",
          borderRadius: "var(--radius-4)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
            borderBottom: "1px solid var(--gray-a5)",
          }}
        >
          <span>Theme Mode</span>
          <SegmentedControl.Root
            value={themeMode}
            onValueChange={(value) => setThemeMode(value as ThemeMode)}
          >
            <SegmentedControl.Item value={ThemeMode.Auto}>
              Auto
            </SegmentedControl.Item>
            <SegmentedControl.Item value={ThemeMode.Light}>
              Light
            </SegmentedControl.Item>
            <SegmentedControl.Item value={ThemeMode.Dark}>
              Dark
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
            borderBottom: "1px solid var(--gray-a5)",
          }}
        >
          <span>Export</span>
          <button
            type="button"
            onClick={onExportData}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span className="icon-file-download" />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
          }}
        >
          <span>Import</span>
          <button
            type="button"
            onClick={onImportData}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span className="icon-file-upload" />
          </button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 560,
          margin: "16px auto",
          border: "1px solid var(--gray-a5)",
          borderRadius: "var(--radius-4)",
          overflow: "hidden",
        }}
      >
        <CryptoSettings />
      </div>

      <div
        style={{
          maxWidth: 560,
          margin: "16px auto",
          border: "1px solid var(--gray-a5)",
          borderRadius: "var(--radius-4)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
            borderBottom: "1px solid var(--gray-a5)",
          }}
        >
          <span>Privacy Policy</span>
          <button
            type="button"
            onClick={() =>
              openUrl(
                "https://nashaofu.github.io/shell360/docs/Privacy-Policy.html",
              )
            }
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span className="icon-arrow-right" />
          </button>
        </div>
        {import.meta.env.TAURI_ENV_PLATFORM === "ios" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 56,
              padding: "0 16px",
              borderBottom: "1px solid var(--gray-a5)",
            }}
          >
            <span>Terms of Use</span>
            <button
              type="button"
              onClick={() =>
                openUrl(
                  "http://www.apple.com/legal/itunes/appstore/dev/stdeula",
                )
              }
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <span className="icon-arrow-right" />
            </button>
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
            borderBottom: "1px solid var(--gray-a5)",
          }}
        >
          <span>About</span>
          <button
            type="button"
            onClick={() => openUrl("https://nashaofu.github.io/shell360/")}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span className="icon-arrow-right" />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 16px",
          }}
        >
          <span>Version</span>
          <span>{version}</span>
        </div>
      </div>

      {import.meta.env.TAURI_ENV_PLATFORM === "ios" && <IOSIAP />}
    </Page>
  );
}
