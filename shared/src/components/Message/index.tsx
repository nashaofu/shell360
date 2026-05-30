import { Text } from "@radix-ui/themes";
import {
  type ReactNode,
  StrictMode,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import styles from "./index.module.less";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type MessageType = "success" | "error" | "info" | "warning" | "loading";

export interface MessageConfig {
  type: MessageType;
  content: ReactNode;
  duration?: number;
  onClose?: () => void;
  /** Unique key for deduplication. If set, calling with the same key
   *  will update the existing message instead of creating a new one. */
  key?: string;
}

interface InternalItem extends Required<
  Pick<MessageConfig, "content" | "duration">
> {
  id: string;
  type: MessageType;
  key?: string;
  onClose?: () => void;
}

export interface MessageGlobalConfig {
  /** @default 3000 */
  duration?: number;
  /** @default 3 */
  maxCount?: number;
  /** @default 24 */
  top?: number;
}

/* ------------------------------------------------------------------ */
/*  Internal state                                                    */
/* ------------------------------------------------------------------ */

type Listener = (items: InternalItem[]) => void;
const listeners = new Set<Listener>();
let items: InternalItem[] = [];
const globalConfig: Required<MessageGlobalConfig> = {
  duration: 3000,
  maxCount: 3,
  top: 24,
};
let idCounter = 0;
const genId = () => `msg-${Date.now()}-${++idCounter}`;

function notify() {
  for (const l of listeners) l([...items]);
}

function addItem(item: InternalItem) {
  // Deduplicate by key
  if (item.key) {
    items = items.filter((i) => i.key !== item.key);
  }
  items = [...items, item];
  // Respect maxCount: remove oldest
  if (items.length > globalConfig.maxCount) {
    items = items.slice(items.length - globalConfig.maxCount);
  }
  notify();
}

function removeItem(id: string) {
  const target = items.find((i) => i.id === id);
  items = items.filter((i) => i.id !== id);
  notify();
  target?.onClose?.();
}

function clearAll() {
  items = [];
  notify();
}

/* ------------------------------------------------------------------ */
/*  Standalone root (fallback when no <MessageProvider />)            */
/* ------------------------------------------------------------------ */

let rootEl: HTMLDivElement | null = null;

function ensureRoot() {
  if (rootEl) return;
  rootEl = document.createElement("div");
  rootEl.setAttribute("data-shell360-message", "true");
  document.body.appendChild(rootEl);
  createRoot(rootEl).render(
    <StrictMode>
      <MessageContainer />
    </StrictMode>,
  );
}

/* ------------------------------------------------------------------ */
/*  MessageContainer — subscribes to items list                       */
/* ------------------------------------------------------------------ */

function useMessageStore() {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback(() => items, []);
  const getServerSnapshot = useCallback(() => items, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function MessageContainer({ top }: { top?: number }) {
  const currentItems = useMessageStore();

  return (
    <div className={styles.container} style={{ top: top ?? globalConfig.top }}>
      {currentItems.map((item) => (
        <MessageNotice
          key={item.id}
          item={item}
          onClose={() => removeItem(item.id)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageNotice — single toast                                      */
/* ------------------------------------------------------------------ */

function MessageNotice({
  item,
  onClose,
}: {
  item: InternalItem;
  onClose: () => void;
}) {
  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = window.setTimeout(onClose, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onClose]);

  return (
    <div
      className={`${styles.notice} ${styles[item.type]}`}
      role="alert"
      aria-live="polite"
    >
      <span
        className={`${styles.icon} ${item.type === "loading" ? styles.spin : ""}`}
        data-type={item.type}
      />
      <Text size="2" className={styles.content}>
        {item.content}
      </Text>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageProvider — place at app root to inherit Theme              */
/* ------------------------------------------------------------------ */

export function MessageProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {createPortal(<MessageContainer />, document.body)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Imperative API  (like antd message)                               */
/* ------------------------------------------------------------------ */

function openMessage(config: MessageConfig): () => void {
  if (listeners.size === 0) ensureRoot();

  const id = genId();
  const duration = config.duration ?? globalConfig.duration;

  addItem({
    id,
    type: config.type,
    content: config.content,
    duration: duration >= 0 ? duration : globalConfig.duration,
    onClose: config.onClose,
    key: config.key,
  });

  return () => removeItem(id);
}

export interface MessageInstance {
  (config: MessageConfig): () => void;
  success(content: ReactNode, duration?: number): () => void;
  error(content: ReactNode, duration?: number): () => void;
  info(content: ReactNode, duration?: number): () => void;
  warning(content: ReactNode, duration?: number): () => void;
  loading(content: ReactNode, duration?: number): () => void;
  open(config: MessageConfig): () => void;
  config(options: MessageGlobalConfig): void;
  destroy(): void;
}

export const message: MessageInstance = Object.assign(
  (config: MessageConfig) => openMessage(config),
  {
    success(content: ReactNode, duration?: number) {
      return openMessage({ type: "success", content, duration });
    },
    error(content: ReactNode, duration?: number) {
      return openMessage({ type: "error", content, duration });
    },
    info(content: ReactNode, duration?: number) {
      return openMessage({ type: "info", content, duration });
    },
    warning(content: ReactNode, duration?: number) {
      return openMessage({ type: "warning", content, duration });
    },
    loading(content: ReactNode, duration?: number) {
      return openMessage({ type: "loading", content, duration: duration ?? 0 });
    },
    open(config: MessageConfig) {
      return openMessage(config);
    },
    config(options: MessageGlobalConfig) {
      if (options.duration !== undefined)
        globalConfig.duration = options.duration;
      if (options.maxCount !== undefined)
        globalConfig.maxCount = options.maxCount;
      if (options.top !== undefined) globalConfig.top = options.top;
    },
    destroy() {
      clearAll();
    },
  },
);
