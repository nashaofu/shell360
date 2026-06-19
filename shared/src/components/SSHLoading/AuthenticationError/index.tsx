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
import {
  type KeyboardInteractiveData,
  KeyboardInteractivePromptForm,
} from "./KeyboardInteractivePromptForm";

function protocolEquivalent(method: AuthenticationMethod): string {
  if (method === AuthenticationMethod.Password) {
    return "Password";
  }
  if (method === AuthenticationMethod.KeyboardInteractive) {
    return "KeyboardInteractive";
  }
  return "PublicKey";
}

function resolveAuthenticationMethod(
  hostMethod: AuthenticationMethod,
  error: unknown,
): AuthenticationMethod {
  const methodSet = (get(error, "methodSet", []) as string[]) ?? [];
  if (
    methodSet.length === 0 ||
    methodSet.includes(protocolEquivalent(hostMethod))
  ) {
    return hostMethod;
  }
  if (methodSet.includes("PublicKey")) {
    return AuthenticationMethod.PublicKey;
  }
  if (methodSet.includes("Password")) {
    return AuthenticationMethod.Password;
  }
  if (methodSet.includes("KeyboardInteractive")) {
    return AuthenticationMethod.KeyboardInteractive;
  }
  return hostMethod;
}

export default function AuthenticationError({
  host,
  error,
  onReAuth,
  onSubmitKeyboardInteractive,
  onClose,
  onOpenAddKey,
}: ErrorProps) {
  const { refresh: refreshHosts } = useHosts();

  const keyboardInteractiveData =
    get(error, "kind") === "KeyboardInteractiveInfoRequest"
      ? (get(error, "keyboardInteractiveData") as
          | KeyboardInteractiveData
          | undefined)
      : undefined;

  const formApi = useForm<AuthenticationFormFields>({
    defaultValues: {
      username: "",
      authenticationMethod: AuthenticationMethod.Password,
      password: "",
      keyId: "",
    },
    values: {
      username: host?.username ?? "",
      authenticationMethod: resolveAuthenticationMethod(
        host?.authenticationMethod ?? AuthenticationMethod.Password,
        error,
      ),
      password: host?.password ?? "",
      keyId: host?.keyId ?? "",
    },
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const errorInfo = useMemo(() => {
    const kind = get(error, "kind");
    const message = get(error, "message");
    if (kind === "Password" || kind === "PublicKey" || kind === "Certificate") {
      const methodSet = get(error, "methodSet", []) as string[];
      const isSupported = methodSet.includes(
        protocolEquivalent(kind as AuthenticationMethod),
      );

      return {
        title: message,
        message:
          isSupported || methodSet.length === 0 ? (
            message
          ) : (
            <>
              The <b>{kind}</b> authentication method is not supported. The
              server only supports the <b>{methodSet.join(", ")}</b>{" "}
              authentication method.
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

  if (keyboardInteractiveData && onSubmitKeyboardInteractive) {
    return (
      <KeyboardInteractivePromptForm
        data={keyboardInteractiveData}
        onSubmit={onSubmitKeyboardInteractive}
        onClose={onClose}
      />
    );
  }

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
            type="button"
            className={styles.splitPrimaryButton}
            onClick={formApi.handleSubmit((values) =>
              onContinue(values, false),
            )}
          >
            Continue
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button type="button" className={styles.splitMenuButton}>
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
