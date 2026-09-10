import { Theme } from "@radix-ui/themes";
import { setSystemBarsAppearance } from "bridge/app";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { RouterProvider } from "react-router-dom";
import { MessageProvider, ModalProvider, useAppearanceValue } from "shared";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import router from "../routes";
import styles from "./index.module.less";

export default function App() {
  const appearance = useAppearanceValue();

  useEffect(() => {
    void setSystemBarsAppearance(appearance === "dark");
  }, [appearance]);

  return (
    <Theme
      className={styles.app}
      hasBackground
      appearance={appearance}
      accentColor="green"
      grayColor="gray"
      panelBackground="translucent"
      radius="medium"
      scaling="100%"
    >
      <ModalProvider appearance={appearance}>
        <MessageProvider appearance={appearance}>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </MessageProvider>
      </ModalProvider>
    </Theme>
  );
}
