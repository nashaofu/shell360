import { Button, DropdownMenu } from "@radix-ui/themes";
import { get } from "lodash-es";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { AuthenticationMethod, updateHost } from "tauri-plugin-data";
import { useHosts } from "@/hooks/useHosts";
import { MoreIcon } from "../../Icon";
import { type ErrorProps, StatusButton } from "../common";
import ErrorText from "../ErrorText";
import styles from "../styles.module.less";

import {
  AuthenticationForm,
  type AuthenticationFormFields,
} from "./AuthenticationForm";

export default function AuthenticationError({
  host,
  error,
  onReAuth,
  onClose,
  onOpenAddKey,
}: ErrorProps) {
  const { refresh: refreshHosts } = useHosts();

  const formApi = useForm<AuthenticationFormFields>({
    defaultValues: {
      username: "",
      authenticationMethod: AuthenticationMethod.Password,
      password: "",
      keyId: "",
    },
    values: {
      username: host?.username ?? "",
      authenticationMethod:
        host?.authenticationMethod ?? AuthenticationMethod.Password,
      password: host?.password ?? "",
      keyId: host?.keyId ?? "",
    },
  });

  const errorInfo = useMemo(() => {
    const kind = get(error, "kind");
    const message = get(error, "message");
    if (kind === "Password" || kind === "PublicKey" || kind === "Certificate") {
      const methodSet = get(error, "methodSet", []) as string[];

      return {
        title: message,
        message: methodSet.includes(kind) ? (
          message
        ) : (
          <>
            The <b>{kind}</b> authentication method is not supported. The server
            only supports the <b>{methodSet.join(", ")}</b> authentication
            method.
          </>
        ),
      };
    }
    return {
      title: "Authentication failed",
      message: message,
    };
  }, [error]);

  const onContinue = useCallback(
    async (values: AuthenticationFormFields, isSave: boolean) => {
      const authenticationMethod =
        values.authenticationMethod || AuthenticationMethod.Password;

      const hostData = {
        ...host,
        username: values.username || "",
        authenticationMethod: authenticationMethod,
        password:
          authenticationMethod === AuthenticationMethod.Password
            ? values.password || ""
            : undefined,
        keyId:
          authenticationMethod === AuthenticationMethod.PublicKey ||
          authenticationMethod === AuthenticationMethod.Certificate
            ? values.keyId || ""
            : undefined,
      };
      if (isSave) {
        await updateHost(hostData);
        await refreshHosts();
      }
      onReAuth(hostData);
    },
    [host, onReAuth, refreshHosts],
  );

  return (
    <form className={styles.authForm} noValidate autoComplete="off">
      <ErrorText title={errorInfo.title} message={errorInfo.message} />
      <AuthenticationForm formApi={formApi} onOpenAddKey={onOpenAddKey} />
      <div className={styles.actions}>
        <StatusButton variant="outlined" onClick={onClose}>
          Close
        </StatusButton>
        <div className={styles.splitButtonGroup}>
          <Button
            className={styles.splitPrimaryButton}
            onClick={formApi.handleSubmit((values) =>
              onContinue(values, false),
            )}
          >
            Continue
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button className={styles.splitMenuButton}>
                <MoreIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
              <DropdownMenu.Item
                onSelect={() => {
                  formApi.handleSubmit((values) => onContinue(values, true))();
                }}
              >
                Save and continue
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
    </form>
  );
}
