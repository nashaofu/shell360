import {
  type ReactNode,
  useState,
  useEffect,
  StrictMode,
} from "react";
import { createRoot } from "react-dom/client";
import { Button, Dialog, Flex } from "@radix-ui/themes";

export type ModalConfig = {
  title?: ReactNode;
  content?: ReactNode;
  /**
   * Custom footer. Pass a render function to receive `close()` for
   * dismissing the modal programmatically from within the footer.
   */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** Called after the modal finishes its close animation. */
  onClose?: () => void;
  /**
   * Whether clicking the overlay or pressing Escape closes the modal.
   * @default true
   */
  maskClosable?: boolean;
};

export type ConfirmOptions = {
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
};

export type AlertOptions = {
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
};

// -------- internal state --------
type InternalConfig = ModalConfig & { id: string };
type Listener = (items: InternalConfig[]) => void;

const listeners: Set<Listener> = new Set();
let currentModals: InternalConfig[] = [];

function notifyModals() {
  for (const l of listeners) l([...currentModals]);
}

function addModal(cfg: InternalConfig) {
  currentModals = [...currentModals, cfg];
  notifyModals();
}

function removeModal(id: string) {
  currentModals = currentModals.filter((m) => m.id !== id);
  notifyModals();
}

// -------- lazy standalone root --------
let rootEl: HTMLDivElement | null = null;

function ensureRoot() {
  if (rootEl) return;
  rootEl = document.createElement("div");
  rootEl.setAttribute("data-shell360-modal", "true");
  document.body.appendChild(rootEl);
  createRoot(rootEl).render(
    <StrictMode>
      <ModalManager />
    </StrictMode>,
  );
}

// -------- ModalManager --------
function ModalManager() {
  const [modals, setModals] = useState<InternalConfig[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setModals(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {modals.map((cfg) => (
        <ModalInstance key={cfg.id} config={cfg} />
      ))}
    </>
  );
}

// -------- ModalProvider --------
/**
 * Optional provider — renders modals inside the React tree so they inherit
 * the Radix Theme context. If omitted, modals fall back to a standalone root.
 */
export function ModalProvider({ children }: { children?: ReactNode }) {
  const [modals, setModals] = useState<InternalConfig[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setModals(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      {modals.map((cfg) => (
        <ModalInstance key={cfg.id} config={cfg} />
      ))}
    </>
  );
}

// -------- ModalInstance --------
function ModalInstance({ config }: { config: InternalConfig }) {
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
    // Wait for Radix close animation before removing from DOM
    setTimeout(() => {
      config.onClose?.();
      removeModal(config.id);
    }, 150);
  };

  const footer =
    typeof config.footer === "function" ? config.footer(close) : config.footer;

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <Dialog.Content
        onEscapeKeyDown={(e) => {
          if (config.maskClosable === false) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (config.maskClosable === false) e.preventDefault();
        }}
      >
        {config.title && <Dialog.Title>{config.title}</Dialog.Title>}
        {config.content !== undefined && (
          <Dialog.Description asChild>
            <div>{config.content}</div>
          </Dialog.Description>
        )}
        {footer}
      </Dialog.Content>
    </Dialog.Root>
  );
}

// -------- imperative API --------
let idCounter = 0;
const genId = () => `modal-${Date.now()}-${++idCounter}`;

function dispatch(cfg: InternalConfig) {
  if (listeners.size === 0) ensureRoot();
  addModal(cfg);
}

export const modal = {
  /**
   * Open a fully custom modal. Returns a function to close it.
   *
   * @example
   * const close = modal.open({ title: 'My Modal', content: <MyForm /> })
   * close() // dismiss programmatically
   */
  open(config: ModalConfig): () => void {
    const id = genId();
    dispatch({ ...config, id });
    return () => removeModal(id);
  },

  /**
   * Show a confirmation dialog.
   * Resolves `true` when the user confirms, `false` when cancelled or dismissed.
   *
   * @example
   * const ok = await modal.confirm({ title: '确认删除?', content: '此操作不可恢复' })
   * if (ok) deleteItem()
   */
  confirm(options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const id = genId();
      const footer = (close: () => void) => (
        <Flex gap="3" justify="end" mt="4">
          <Button
            variant="soft"
            color="gray"
            onClick={() => {
              close();
              settle(false);
            }}
          >
            {options.cancelText ?? "取消"}
          </Button>
          <Button
            onClick={() => {
              close();
              settle(true);
            }}
          >
            {options.okText ?? "确认"}
          </Button>
        </Flex>
      );

      dispatch({
        id,
        title: options.title,
        content: options.content,
        footer,
        maskClosable: false,
        onClose: () => settle(false),
      });
    });
  },

  /**
   * Show an alert dialog. Resolves when the user clicks OK.
   *
   * @example
   * await modal.alert({ title: '提示', content: '保存成功' })
   */
  alert(options: AlertOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const id = genId();
      const footer = (close: () => void) => (
        <Flex justify="end" mt="4">
          <Button
            onClick={() => {
              close();
              settle();
            }}
          >
            {options.okText ?? "确定"}
          </Button>
        </Flex>
      );

      dispatch({
        id,
        title: options.title,
        content: options.content,
        footer,
        maskClosable: false,
        onClose: settle,
      });
    });
  },
};
