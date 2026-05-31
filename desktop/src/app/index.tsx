import { Theme } from "@radix-ui/themes";
import { RouterProvider } from "react-router-dom";
import { MessageProvider, ModalProvider, useAppearanceValue } from "shared";
import { useAutoCheckUpdate } from "@/atoms/update.atom";
import UpdateDialog from "@/components/UpdateDialog";
import router from "@/routes";
import styles from "./index.module.less";

export default function App() {
  const appearance = useAppearanceValue();

  useAutoCheckUpdate();

  const providerAppearance = appearance === "inherit" ? undefined : appearance;

  return (
    <Theme
      className={styles.app}
      hasBackground
      appearance={appearance}
      accentColor="indigo"
      grayColor="auto"
      panelBackground="translucent"
      radius="medium"
      scaling="100%"
    >
      <ModalProvider appearance={providerAppearance}>
        <MessageProvider appearance={providerAppearance}>
          <RouterProvider router={router} />
          <UpdateDialog />
        </MessageProvider>
      </ModalProvider>
    </Theme>
  );
}
