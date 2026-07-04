import { Theme } from "@radix-ui/themes";
import { ErrorBoundary } from "react-error-boundary";
import { RouterProvider } from "react-router-dom";
import { MessageProvider, ModalProvider, useAppearanceValue } from "shared";
import ErrorBoundaryFallback from "../components/ErrorBoundaryFallback";
import router from "../routes";
import styles from "./index.module.less";

export default function App() {
  const appearance = useAppearanceValue();
  const providerAppearance = appearance === "inherit" ? undefined : appearance;

  return (
    <Theme
      className={styles.app}
      hasBackground
      appearance={appearance}
      accentColor="indigo"
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
