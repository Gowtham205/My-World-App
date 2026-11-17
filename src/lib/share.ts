import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback for restricted WebViews
    }
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function shareText(options: {
  title: string;
  text: string;
  dialogTitle?: string;
}): Promise<'shared' | 'copied' | 'failed'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: options.title,
        text: options.text,
        dialogTitle: options.dialogTitle || options.title,
      });
      return 'shared';
    } catch {
      // User cancelled or native share unavailable; fall back to clipboard
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
      });
      return 'shared';
    } catch {
      // Fall back to copy
    }
  }

  const copied = await copyText(options.text);
  return copied ? 'copied' : 'failed';
}
