import clsx from "clsx";
import panel from "@/styles/panel.module.less";
import styles from "./index.module.less";

type PortForwardingActionsProps = {
  isRunning: boolean;
  variant: "card" | "row";
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
};

export default function PortForwardingActions({
  isRunning,
  variant,
  onDelete,
  onEdit,
  onToggle,
}: PortForwardingActionsProps) {
  const containerClass =
    variant === "card" ? styles.cardActions : panel.actionGroup;
  const actionClass =
    variant === "card" ? styles.primaryBtn : panel.actionButton;
  const dangerClass =
    variant === "card" ? styles.dangerBtn : panel.dangerButton;
  const deleteClass =
    variant === "card"
      ? styles.dangerBtn
      : clsx(panel.actionButton, panel.dangerButton);

  return (
    <div className={containerClass}>
      <button
        type="button"
        className={clsx(actionClass, isRunning && dangerClass)}
        onClick={onToggle}
      >
        {isRunning ? "Stop" : "Start"}
      </button>
      <button type="button" className={actionClass} onClick={onEdit}>
        Edit
      </button>
      <button type="button" className={deleteClass} onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
