import {
  type OptionsWithExtraProps,
  useSnackbar,
  type VariantType,
} from "notistack";
import { type ReactNode, useMemo } from "react";

export default function useMessage() {
  const { enqueueSnackbar } = useSnackbar();

  const fns = useMemo(() => {
    const implMessageFn =
      (variant: VariantType) =>
      ({
        anchorOrigin = {
          vertical: "top",
          horizontal: "center",
        },
        ...props
      }: Omit<OptionsWithExtraProps<VariantType>, "variant"> & {
        message: ReactNode;
      }) => {
        enqueueSnackbar({
          ...props,
          anchorOrigin,
          variant,
        });
      };

    return {
      info: implMessageFn("info"),
      success: implMessageFn("success"),
      error: implMessageFn("error"),
      warning: implMessageFn("warning"),
    };
  }, [enqueueSnackbar]);

  return fns;
}
