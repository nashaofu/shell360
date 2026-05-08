import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { useGlobalStateAtomWithApi } from "@/atom/globalState";
import overlay from "@/utils/overlay";
import logo from "./logo.svg";
import styles from "./index.module.less";
import Menus from "./Menus";
import Terminals from "./Terminals";

export default function Sidebar() {
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();
  const navigate = useNavigate();

  const goSettings = useCallback(() => {
    navigate("/settings", { replace: true });
    globalStateAtomWithApi.closeSidebar();
  }, [globalStateAtomWithApi, navigate]);

  useEffect(() => {
    if (globalStateAtomWithApi.isOpenSidebar) {
      overlay.add(globalStateAtomWithApi.closeSidebar);
    } else {
      overlay.delete(globalStateAtomWithApi.closeSidebar);
    }

    return () => {
      overlay.delete(globalStateAtomWithApi.closeSidebar);
    };
  }, [
    globalStateAtomWithApi.isOpenSidebar,
    globalStateAtomWithApi.closeSidebar,
  ]);

  if (!globalStateAtomWithApi.isOpenSidebar) return null;

  return createPortal(
    <>
      <div
        className={styles.overlay}
        onClick={globalStateAtomWithApi.closeSidebar}
      />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <img className={styles.avatar} src={logo} alt="logo" />
            <span className={styles.logoText}>Shell360</span>
          </div>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={goSettings}
          >
            <span className="icon-settings" />
          </button>
        </div>

        <hr className={styles.divider} />

        <Menus onClick={globalStateAtomWithApi.closeSidebar} />

        <hr className={styles.divider} />

        <div className={styles.scrollArea}>
          <Terminals onClick={globalStateAtomWithApi.closeSidebar} />
        </div>
      </div>
    </>,
    document.body,
  );
}
