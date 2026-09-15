import type { FormEventHandler } from "react";
import BasicForm from "./BasicForm";
import styles from "./EditHostForm.module.less";
import JumpHostsForm from "./JumpHostsForm";
import TerminalSettingsForm from "./TerminalSettingsForm";
import type { EditHostFormApi } from "./types";

export type EditHostFormProps = {
  formApi: EditHostFormApi;
  onOpenAddKey: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function EditHostForm({
  formApi,
  onOpenAddKey,
  onSubmit,
}: EditHostFormProps) {
  return (
    <form
      className={styles.form}
      noValidate
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(e);
      }}
    >
      <BasicForm formApi={formApi} sx={{ mb: 3 }} onOpenAddKey={onOpenAddKey} />
      <JumpHostsForm formApi={formApi} sx={{ mb: 3 }} />
      <TerminalSettingsForm formApi={formApi} sx={{ mb: 3 }} />
    </form>
  );
}
