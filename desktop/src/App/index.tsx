import { Theme } from "@radix-ui/themes";
import { RouterProvider } from "react-router-dom";
import { useAppearanceValue } from "shared";
import { useAutoCheckUpdate } from "@/app/model/updateAtom";
import UpdateDialog from "@/widgets/UpdateDialog";
import styles from "./index.module.less";
import router from "./routes";

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
