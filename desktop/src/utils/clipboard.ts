import { writeText } from '@tauri-apps/plugin-clipboard-manager';

function select(el: HTMLElement) {
  if (
    !(el instanceof HTMLInputElement)
    && !(el instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  const isReadOnly = el.hasAttribute('readonly');
  const selectionStart = el.selectionStart ?? null;
  const selectionEnd = el.selectionEnd ?? null;

  if (!isReadOnly) {
    el.setAttribute('readonly', '');
  }

  el.setSelectionRange(selectionStart, selectionEnd);

  if (!isReadOnly) {
    el.removeAttribute('readonly');
  }
}

function clear(el: HTMLElement, selectionType: 'start' | 'end') {
  if (
    !(el instanceof HTMLInputElement)
    && !(el instanceof HTMLTextAreaElement)
  ) {
    return;
  }
  const selectionStart = el.selectionStart ?? null;
  const selectionEnd = el.selectionEnd ?? null;

  if (selectionType === 'start') {
    el.setSelectionRange(selectionStart, selectionStart, 'none');
  } else {
    el.setSelectionRange(selectionEnd, selectionEnd, 'none');
  }
}

export function cut(cutEl: HTMLElement | null) {
  if (!cutEl) {
    return;
  }

  select(cutEl);
  document.execCommand('cut');
  clear(cutEl, 'start');
}

export function copy(content?: string) {
  if (!content) {
    return;
  }

  writeText(content);
}

export function paste(pasteEl: HTMLElement | null, content?: string) {
  if (!pasteEl || !content) {
    return;
  }

  select(pasteEl);
  document.execCommand('insertText', false, content);
  clear(pasteEl, 'end');
}
