import {
  type ReactNode,
  useEffect,
  useReducer,
  createPortal,
  StrictMode,
} from "react";
import { createRoot } from "react-dom/client";

import styles from "./index.module.less";

export type MessageType = "success" | "error" | "info" | "warning" | "loading";

export interface MessageItem {
  id: string;
  type: MessageType;
  content: ReactNode;
  duration: number;
  onClose?: () => void;
}

export interface MessageOptions {
  /** Auto-close duration in ms. 0 = never auto-close. Default: 3000 */
  duration?: number;
  onClose?: () => void;
}

// ---------- event bus ----------
type Listener = (items: MessageItem[]) => void;
const listeners: Set<Listener> = new Set();
let currentItems: MessageItem[] = [];

function notify() {
  for (const l of listeners) l([...currentItems]);
}

function addItem(item: MessageItem) {
  currentItems = [...currentItems, item];
  notify();
}

function removeItem(id: string) {
  currentItems = currentItems.filter((m) => m.id !== id);
  notify();
}

// ---------- lazy standalone root ----------
let rootContainer: HTMLDivElement | null = null;

function ensureRoot() {
  if (rootContainer) return;
  rootContainer = document.createElement("div");
  rootContainer.setAttribute("data-shell360-message", "true");
  document.body.appendChild(rootContainer);
  createRoot(rootContainer).render(
    <StrictMode>
      <MessageList />
    </StrictMode>,
  );
}

// ---------- MessageList ----------
const ICON_MAP: Record<MessageType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
  loading: "",
};

function MessageList() {
  const [items, dispatch] = useReducer(
    (_: MessageItem[], next: MessageItem[]) => next,
    [],
  );

  useEffect(() => {
    const listener: Listener = (next) => dispatch(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div className={styles.container}>
      {items.map((item) => (
        <MessageNotice
          key={item.id}
          item={item}
          onClose={() => {
            item.onClose?.();
            removeItem(item.id);
          }}
        />
      ))}
    </div>
  );
}

// ---------- MessageNotice ----------
interface MessageNoticeProps {
  item: MessageItem;
  onClose: () => void;
}

function MessageNotice({ item, onClose }: MessageNoticeProps) {
  useEffect(() => {
    if (item.duration === 0) return;
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
      >
        {ICON_MAP[item.type]}
      </span>
      <span className={styles.content}>{item.content}</span>
    </div>
  );
}

// ---------- MessageProvider ----------
/**
 * Optional provider — renders messages inside the React tree so they inherit
 * the Radix Theme context. If omitted, messages fall back to a standalone root.
 */
export function MessageProvider({ children }: { children?: ReactNode }) {
  const [items, dispatch] = useReducer(
    (_: MessageItem[], next: MessageItem[]) => next,
    [],
  );

  useEffect(() => {
    const listener: Listener = (next) => dispatch(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      {createPortal(
        <div className={styles.container}>
          {items.map((item) => (
            <MessageNotice
              key={item.id}
              item={item}
              onClose={() => {
                item.onClose?.();
                removeItem(item.id);
              }}
            />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------- imperative API ----------
let idCounter = 0;
const genId = () => `msg-${Date.now()}-${++idCounter}`;

function open(
  type: MessageType,
  content: ReactNode,
  options?: MessageOptions,
): () => void {
  if (listeners.size === 0) ensureRoot();

  const id = genId();
  const { duration = 3000, onClose } = options ?? {};

  addItem({ id, type, content, duration, onClose });

  return () => removeItem(id);
}

export const message = {
  open(config: {
    type: MessageType;
    content: ReactNode;
    duration?: number;
    onClose?: () => void;
  }): () => void {
    return open(config.type, config.content, {
      duration: config.duration,
      onClose: config.onClose,
    });
  },
  success(content: ReactNode, options?: MessageOptions) {
    return open("success", content, options);
  },
  error(content: ReactNode, options?: MessageOptions) {
    return open("error", content, options);
  },
  info(content: ReactNode, options?: MessageOptions) {
    return open("info", content, options);
  },
  warning(content: ReactNode, options?: MessageOptions) {
    return open("warning", content, options);
  },
  loading(content: ReactNode, options?: MessageOptions) {
    return open("loading", content, options);
  },
};
