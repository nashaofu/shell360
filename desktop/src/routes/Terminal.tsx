import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTerminalsAtomWithApi } from "shared";
import AddKey from "@/components/AddKey";
import SSHTerminal from "@/components/SshTerminal";
import styles from "./Terminal.module.less";

export default function Terminal() {
  const { uuid } = useParams<{ uuid: string }>();
  const terminalsApi = useTerminalsAtomWithApi();
  const [openAddKey, setOpenAddKey] = useState(false);

  const terminal = uuid ? terminalsApi.state.get(uuid) : undefined;

  if (!terminal) {
    return <Navigate to="/" replace />;
  }

  const onClose = () => {
    if (uuid) terminalsApi.delete(uuid);
  };

  return (
    <div className={styles.terminal}>
      <SSHTerminal
        item={terminal}
        style={{ width: "100%", height: "100%" }}
        onClose={onClose}
        onOpenAddKey={() => setOpenAddKey(true)}
      />
      <AddKey
        open={openAddKey}
        onOk={() => setOpenAddKey(false)}
        onCancel={() => setOpenAddKey(false)}
      />
    </div>
  );
}
