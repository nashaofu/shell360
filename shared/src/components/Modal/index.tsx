import { Button, type ButtonProps, Dialog, Flex, Text } from "@radix-ui/themes";
import {
  type ReactNode,
  StrictMode,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ModalConfig {
  title?: ReactNode;
  content?: ReactNode;
  /** Custom footer. Pass a render function to receive `close()` for
   *  dismissing the modal programmatically. */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  onClose?: () => void;
  /** @default true */
  maskClosable?: boolean;
  /** @default 400 */
  maxWidth?: string | number;
  /** Optional icon for preset methods (info/success/error/warning). */
  icon?: ReactNode;
}

export interface ConfirmOptions {
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  /** @default false */
  danger?: boolean;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  okButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  cancelButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  /** Alias for okButtonProps */
  OkButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  /** Alias for cancelButtonProps */
  CancelButtonProps?: Omit<ButtonProps, "children" | "onClick">;
}

export interface AlertOptions {
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
}

/* ------------------------------------------------------------------ */
/*  Internal state                                                    */
/* ------------------------------------------------------------------ */

interface InternalModal extends ModalConfig {
  id: string;
  /** Which preset method spawned this modal (so ModalInstance knows icon). */
  preset?: "info" | "success" | "error" | "warning";
}

type Listener = (modals: InternalModal[]) => void;
const listeners = new Set<Listener>();
let modals: InternalModal[] = [];
let idCounter = 0;
const genId = () => `modal-${Date.now()}-${++idCounter}`;

function notify() {
  for (const l of listeners) l([...modals]);
}

function addModal(m: InternalModal) {
  modals = [...modals, m];
  notify();
}

function removeModal(id: string) {
  const m = modals.find((x) => x.id === id);
  modals = modals.filter((x) => x.id !== id);
  notify();
  m?.onClose?.();
}

/* ------------------------------------------------------------------ */
/*  Standalone root                                                   */
/* ------------------------------------------------------------------ */

let rootEl: HTMLDivElement | null = null;

function ensureRoot() {
  if (rootEl) return;
  rootEl = document.createElement("div");
  rootEl.setAttribute("data-shell360-modal", "true");
  document.body.appendChild(rootEl);
  createRoot(rootEl).render(
    <StrictMode>
      <ModalLayer />
    </StrictMode>,
  );
}

/* ------------------------------------------------------------------ */
/*  ModalLayer — subscribes to modal list                             */
/* ------------------------------------------------------------------ */

function useModalStore() {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback(() => modals, []);
  const getServerSnapshot = useCallback(() => modals, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ModalLayer() {
  const current = useModalStore();

  return (
    <>
      {current.map((cfg) => (
        <ModalInstance key={cfg.id} config={cfg} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ModalProvider — render inside React tree for Theme context        */
/* ------------------------------------------------------------------ */

export function ModalProvider({ children }: { children?: ReactNode }) {
  return (
    <>
      {children}
      {createPortal(<ModalLayer />, document.body)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Preset icon SVG paths                                             */
/* ------------------------------------------------------------------ */

const PRESET_ICONS: Record<string, ReactNode> = {
  info: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--blue-9)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  success: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-9)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 8 10 16 7 13" />
    </svg>
  ),
  error: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--red-9)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--amber-9)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  ModalInstance                                                     */
/* ------------------------------------------------------------------ */

function ModalInstance({ config }: { config: InternalModal }) {
  const [open, setOpen] = useState(true);
  const closeInProgress = useRef(false);

  const close = useCallback(() => {
    if (closeInProgress.current) return;
    closeInProgress.current = true;
    setOpen(false);
    // Wait for Radix close animation
    setTimeout(() => {
      removeModal(config.id);
    }, 200);
  }, [config.id]);

  const footer =
    typeof config.footer === "function" ? config.footer(close) : config.footer;

  const resolvedIcon =
    config.icon ?? (config.preset ? PRESET_ICONS[config.preset] : undefined);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <Dialog.Content
        maxWidth={config.maxWidth != null ? String(config.maxWidth) : "400px"}
        onEscapeKeyDown={(e) => {
          if (config.maskClosable === false) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (config.maskClosable === false) e.preventDefault();
        }}
      >
        {config.title && (
          <Dialog.Title>
            <Flex align="center" gap="2">
              {resolvedIcon}
              {config.title}
            </Flex>
          </Dialog.Title>
        )}
        {config.content !== undefined && (
          <Text
            as="div"
            size="2"
            color="gray"
            style={{ userSelect: "text", lineHeight: 1.6 }}
          >
            {config.content}
          </Text>
        )}
        {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
      </Dialog.Content>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Default footer factory                                            */
/* ------------------------------------------------------------------ */

function confirmFooter(
  options: ConfirmOptions & { isAlert?: boolean },
  close: () => void,
  settle: (value: boolean) => void,
) {
  const okProps = options.okButtonProps ?? options.OkButtonProps ?? {};
  const cancelProps =
    options.cancelButtonProps ?? options.CancelButtonProps ?? {};

  return (
    <Flex gap="3" justify="end">
      {!options.isAlert && (
        <Button
          {...cancelProps}
          variant="soft"
          color="gray"
          onClick={async () => {
            await options.onCancel?.();
            close();
            settle(false);
          }}
        >
          {options.cancelText ?? "取消"}
        </Button>
      )}
      <Button
        {...okProps}
        color={options.danger ? "red" : (okProps.color ?? undefined)}
        onClick={async () => {
          await options.onOk?.();
          close();
          settle(true);
        }}
      >
        {options.okText ?? (options.isAlert ? "确定" : "确认")}
      </Button>
    </Flex>
  );
}

/* ------------------------------------------------------------------ */
/*  Imperative API  (like antd modal)                                 */
/* ------------------------------------------------------------------ */

function dispatch(config: InternalModal) {
  if (listeners.size === 0) {
    modals = [...modals, config];
    ensureRoot();
  } else {
    addModal(config);
  }
}

export interface ModalInstanceAPI {
  open(config: ModalConfig): () => void;
  info(
    options: AlertOptions & { onOk?: () => void | Promise<void> },
  ): Promise<void>;
  success(
    options: AlertOptions & { onOk?: () => void | Promise<void> },
  ): Promise<void>;
  error(
    options: AlertOptions & { onOk?: () => void | Promise<void> },
  ): Promise<void>;
  warning(
    options: AlertOptions & { onOk?: () => void | Promise<void> },
  ): Promise<void>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  alert(options: AlertOptions): Promise<void>;
  destroyAll(): void;
}

export const modal: ModalInstanceAPI = {
  open(config: ModalConfig): () => void {
    const id = genId();
    dispatch({ ...config, id });
    return () => removeModal(id);
  },

  info(options) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const id = genId();
      dispatch({
        id,
        preset: "info",
        title: options.title,
        content: options.content,
        icon: PRESET_ICONS.info,
        maskClosable: true,
        footer: (close) =>
          confirmFooter(
            { ...options, isAlert: true, okText: options.okText ?? "知道了" },
            close,
            () => settle(),
          ),
        onClose: settle,
      });
    });
  },

  success(options) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const id = genId();
      dispatch({
        id,
        preset: "success",
        title: options.title,
        content: options.content,
        icon: PRESET_ICONS.success,
        maskClosable: true,
        footer: (close) =>
          confirmFooter(
            { ...options, isAlert: true, okText: options.okText ?? "知道了" },
            close,
            () => settle(),
          ),
        onClose: settle,
      });
    });
  },

  error(options) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const id = genId();
      dispatch({
        id,
        preset: "error",
        title: options.title,
        content: options.content,
        icon: PRESET_ICONS.error,
        maskClosable: true,
        footer: (close) =>
          confirmFooter(
            { ...options, isAlert: true, okText: options.okText ?? "知道了" },
            close,
            () => settle(),
          ),
        onClose: settle,
      });
    });
  },

  warning(options) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const id = genId();
      dispatch({
        id,
        preset: "warning",
        title: options.title,
        content: options.content,
        icon: PRESET_ICONS.warning,
        maskClosable: true,
        footer: (close) =>
          confirmFooter(
            { ...options, isAlert: true, okText: options.okText ?? "知道了" },
            close,
            () => settle(),
          ),
        onClose: settle,
      });
    });
  },

  confirm(options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const id = genId();
      dispatch({
        id,
        title: options.title,
        content: options.content,
        maskClosable: false,
        footer: (close) => confirmFooter(options, close, settle),
        onClose: () => settle(false),
      });
    });
  },

  alert(options: AlertOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const id = genId();
      dispatch({
        id,
        title: options.title,
        content: options.content,
        maskClosable: false,
        footer: (close) =>
          confirmFooter({ ...options, isAlert: true }, close, () => settle()),
        onClose: settle,
      });
    });
  },

  destroyAll() {
    const ids = [...modals];
    modals = [];
    notify();
    for (const m of ids) m.onClose?.();
  },
};
