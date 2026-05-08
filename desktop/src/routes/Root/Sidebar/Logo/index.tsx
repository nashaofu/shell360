import { useUpdateAtom } from "@/atom/updateAtom";
import styles from "./index.module.less";
import logo from "./logo.svg";

type LogoProps = {
  expand?: boolean;
};

export default function Logo({ expand }: LogoProps) {
  const { update, setOpenUpdateDialog } = useUpdateAtom();

  return (
    <div className={styles.logoWrap}>
      <div className={styles.avatarWrap}>
        <img className={styles.avatar} src={logo} alt="logo" />
        {!!update?.available && (
          <div
            className={`${styles.badge} ${expand ? styles.badgeFull : styles.badgeDot}`}
            onClick={() => setOpenUpdateDialog(true)}
          >
            {expand && "NEW"}
          </div>
        )}
      </div>
      {expand && <span className={styles.logoText}>Shell360</span>}
    </div>
  );
}
