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
  const providerAppearance = appearance === "inherit" ? undefined : appearance;

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemBars = () => {
      void setSystemBarsAppearance(
        appearance === "dark" ||
          (appearance === "inherit" && colorScheme.matches),
      );
    };

    syncSystemBars();
    if (appearance !== "inherit") return;

    colorScheme.addEventListener("change", syncSystemBars);
    return () => colorScheme.removeEventListener("change", syncSystemBars);
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
      <ModalProvider appearance={providerAppearance}>
        <MessageProvider appearance={providerAppearance}>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </MessageProvider>
      </ModalProvider>
    </Theme>
  );
}
