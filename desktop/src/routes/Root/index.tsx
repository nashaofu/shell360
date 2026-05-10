import AppShell from "./AppShell";
import styles from "./index.module.less";
import NavRail from "./NavRail";
import TitleBar from "./TitleBar";
import TopBar from "./TopBar";
import Workspace from "./Workspace";

export default function Root() {
  return (
    <div className={styles.root}>
      <TitleBar>
        <TopBar />
      </TitleBar>
      <AppShell navRail={<NavRail />} workspace={<Workspace />} />
    </div>
  );
}
