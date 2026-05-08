import { useColorsAtomWithApi } from "@/atom/colorsAtom";
import { TITLE_BAR_Z_INDEX } from "@/constants/titleBar";
import styles from "./index.module.less";
import Auth from "./Auth";
import Content from "./Content";
import TitleBar from "./Titlebar";

export default function Root() {
  const colorsAtomWithApi = useColorsAtomWithApi();

  return (
    <div
      className={styles.root}
      style={{ backgroundColor: colorsAtomWithApi.colors.bgColor }}
    >
      <div
        className={styles.titleBarWrap}
        style={{ zIndex: TITLE_BAR_Z_INDEX }}
      >
        <TitleBar />
      </div>
      <Auth>
        <Content></Content>
      </Auth>
    </div>
  );
}
