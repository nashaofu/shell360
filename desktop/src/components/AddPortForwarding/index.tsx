import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  PortForwardingForm,
  type PortForwardingFormFields,
  usePortForwardings,
} from "shared";
import {
  addPortForwarding,
  type PortForwarding,
  PortForwardingType,
  updatePortForwarding,
} from "tauri-plugin-data";

import DrawerFooter from "@/components/DrawerFooter";
import PageDrawer from "@/components/PageDrawer";

type AddPortForwardingProps = {
  open?: boolean;
  data?: PortForwarding;
  onOk: () => unknown;
  onCancel: () => unknown;
};

export default function AddPortForwarding({
  open,
  data,
  onOk,
  onCancel,
}: AddPortForwardingProps) {
  const { refresh: refreshPortForwardings } = usePortForwardings();
  const formApi = useForm<PortForwardingFormFields>({
    defaultValues: {
      name: "",
      portForwardingType: PortForwardingType.Local,
      hostId: "",
      localAddress: "",
      localPort: "",
      remoteAddress: "",
      remotePort: "",
    },
    values: {
      name: data?.name ?? "",
      portForwardingType: data?.portForwardingType ?? PortForwardingType.Local,
      hostId: data?.hostId ?? "",
      localAddress: data?.localAddress ?? "",
      localPort: data?.localPort ?? "",
      remoteAddress: data?.remoteAddress ?? "",
      remotePort: data?.remotePort ?? "",
    },
  });

  const save = useCallback(
    (values: PortForwardingFormFields) => {
      const portForwardingData: Omit<PortForwarding, "id"> = {
        name: values.name,
        portForwardingType: values.portForwardingType,
        hostId: values.hostId,
        localAddress: values.localAddress,
        localPort: Number(values.localPort),
        remoteAddress:
          values.remoteAddress !== undefined && values.remoteAddress !== ""
            ? values.remoteAddress
            : undefined,
        remotePort:
          values.remotePort !== undefined && values.remotePort !== ""
            ? Number(values.remotePort)
            : undefined,
      };
      if (data) {
        return updatePortForwarding({
          ...portForwardingData,
          id: data.id,
        });
      }

      return addPortForwarding(portForwardingData);
    },
    [data],
  );

  const onSave = useCallback(
    async (values: PortForwardingFormFields) => {
      await save(values);
      await refreshPortForwardings();
      onOk();
    },
    [onOk, save, refreshPortForwardings],
  );

  useEffect(() => {
    if (open) {
      return;
    }

    formApi.reset();
  }, [formApi, open]);

  return (
    <PageDrawer
      open={open}
      title={data ? "Edit tunnel" : "Add tunnel"}
      onCancel={onCancel}
      footer={
        <DrawerFooter
          onCancel={onCancel}
          onSubmit={formApi.handleSubmit(onSave)}
        />
      }
    >
      <PortForwardingForm formApi={formApi}></PortForwardingForm>
    </PageDrawer>
  );
}
