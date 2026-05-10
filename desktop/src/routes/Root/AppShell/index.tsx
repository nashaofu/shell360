import styles from "./index.module.less";

type AppShellProps = {
  navRail: React.ReactNode;
  workspace: React.ReactNode;
};

export default function AppShell({ navRail, workspace }: AppShellProps) {
  return (
    <div className={styles.appShell}>
      {navRail}
      {workspace}
    </div>
  );
}
