import { Theme } from "@radix-ui/themes";
import { RouterProvider } from "react-router-dom";
import { useAppearanceValue } from "shared";
import { useAutoCheckUpdate } from "@/atoms/update.atom";
import UpdateDialog from "@/components/UpdateDialog";
import router from "@/routes";
import styles from "./index.module.less";

export default function App() {
  const appearance = useAppearanceValue();
  useAutoCheckUpdate();

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
      <RouterProvider router={router} />
      <UpdateDialog />
    </Theme>
  );
}
