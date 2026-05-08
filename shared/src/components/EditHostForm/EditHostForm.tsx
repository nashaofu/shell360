import BasicForm from "./BasicForm";
import JumpHostsForm from "./JumpHostsForm";
import TerminalSettingsForm from "./TerminalSettingsForm";
import type { EditHostFormApi } from "./types";
import styles from "./EditHostForm.module.less";

export type EditHostFormProps = {
  formApi: EditHostFormApi;
  onOpenAddKey: () => void;
};

export function EditHostForm({ formApi, onOpenAddKey }: EditHostFormProps) {
  return (
    <form className={styles.form} noValidate autoComplete="off">
      <BasicForm formApi={formApi} sx={{ mb: 3 }} onOpenAddKey={onOpenAddKey} />
      <JumpHostsForm formApi={formApi} sx={{ mb: 3 }} />
      <TerminalSettingsForm formApi={formApi} sx={{ mb: 3 }} />
    </form>
  );
}
