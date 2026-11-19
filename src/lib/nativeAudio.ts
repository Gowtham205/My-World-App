import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { AppRoute, CustomAudioTone } from '../types/sanctuary';

export interface NativeScheduleItem {
  id: string;
  notifId: number;
  kind: 'alarm' | 'reminder' | 'calm';
  entityId: string;
  title: string;
  body: string;
  soundId: string;
  soundPath: string;
  soundName: string;
  route: AppRoute;
  snoozeMinutes: number;
  repeating: boolean;
  repeatDays?: number[];
  hhmm?: string;
  triggerAtMs: number;
}

export interface NativeAlertEvent {
  type: 'fired' | 'snooze' | 'auto_snoozed' | 'dismiss';
  scheduleId: string;
  notifId: number;
  kind: 'alarm' | 'reminder' | 'calm';
  entityId: string;
  title: string;
  body: string;
  soundId?: string;
  soundName?: string;
  route?: AppRoute;
  snoozeMinutes?: number;
  snoozeTargetMs?: number;
  minuteKey?: string;
  timestampMs?: number;
}

export interface AudioDiagnostics {
  mediaVolume: number;
  mediaMaxVolume: number;
  canExactAlarms: boolean;
  notificationsEnabled: boolean;
}

export interface ExportToDeviceResult {
  ok: boolean;
  uri?: string;
  displayPath: string;
  error?: string;
}

interface SanctuaryAudioPluginContract {
  syncSchedules(options: { schedules: NativeScheduleItem[] }): Promise<{ scheduledCount: number }>;
  startRingtone(options: {
    scheduleId: string;
    notifId: number;
    kind: 'alarm' | 'reminder' | 'calm';
    entityId?: string;
    title: string;
    body?: string;
    soundId?: string;
    soundPath?: string;
    soundName?: string;
    route?: AppRoute;
    snoozeMinutes?: number;
    isTest?: boolean;
    slotKey?: string;
  }): Promise<{ started: boolean; reason?: string }>;
  stopRingtone(options: { notifId?: number }): Promise<void>;
  playChime(options: { soundId?: string; soundPath?: string; maxMs?: number }): Promise<void>;
  stopChime(): Promise<void>;
  tryClaimSlot(options: { slotKey: string }): Promise<{ claimed: boolean }>;
  drainPendingEvents(): Promise<{ events: NativeAlertEvent[]; pendingRoute?: AppRoute }>;
  getAudioDiagnostics(): Promise<AudioDiagnostics>;
  openExactAlarmSettings(): Promise<void>;
  exportToDeviceStorage(options: {
    filename: string;
    mimeType: string;
    folderType: 'image' | 'video' | 'backup' | 'document';
    sourcePath?: string;
    base64Data?: string;
    textContent?: string;
  }): Promise<{ ok: boolean; uri?: string; displayPath: string }>;
  addListener(
    eventName: 'nativeAlertEvent',
    listenerFunc: (event: NativeAlertEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'routeIntent',
    listenerFunc: (event: { route: AppRoute }) => void
  ): Promise<PluginListenerHandle>;
}

const SanctuaryAudio = registerPlugin<SanctuaryAudioPluginContract>('SanctuaryAudio');

const TONES_DIR = 'sanctuary_tones';
const CHUNK_BYTE_SIZE = 512 * 1023;
const syncedTonePathCache = new Map<string, string>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const blockSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += blockSize) {
    const slice = bytes.subarray(i, i + blockSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function extensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('aac')) return 'aac';
  if (lower.includes('flac')) return 'flac';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('opus')) return 'opus';
  return 'mp3';
}

export async function syncCustomToneFileToNative(
  tone?: CustomAudioTone | null
): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform() || !tone?.blob) return undefined;

  const cached = syncedTonePathCache.get(tone.id);
  if (cached) return cached;

  const safeId = tone.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = extensionFromMime(tone.mimeType || '');
  const relativePath = `${TONES_DIR}/${safeId}.${ext}`;

  try {
    try {
      await Filesystem.mkdir({
        directory: Directory.Data,
        path: TONES_DIR,
        recursive: true,
      });
    } catch {
      // Directory already exists
    }

    const totalSize = tone.blob.size;
    if (totalSize === 0) return undefined;

    let offset = 0;
    let first = true;
    while (offset < totalSize) {
      const end = Math.min(offset + CHUNK_BYTE_SIZE, totalSize);
      const buf = await tone.blob.slice(offset, end).arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      if (first) {
        await Filesystem.writeFile({
          directory: Directory.Data,
          path: relativePath,
          data: b64,
          recursive: true,
        });
        first = false;
      } else {
        await Filesystem.appendFile({
          directory: Directory.Data,
          path: relativePath,
          data: b64,
        });
      }
      offset = end;
    }

    syncedTonePathCache.set(tone.id, relativePath);
    return relativePath;
  } catch {
    return undefined;
  }
}

export async function syncAllCustomTonesToNative(
  tones: CustomAudioTone[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!Capacitor.isNativePlatform()) return result;

  for (const tone of tones) {
    const path = await syncCustomToneFileToNative(tone);
    if (path) {
      result.set(tone.id, path);
    }
  }
  return result;
}

export async function syncNativeSchedules(
  schedules: NativeScheduleItem[]
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SanctuaryAudio.syncSchedules({ schedules });
  } catch {
    // ignore native sync errors
  }
}

export async function startNativeRingtone(params: {
  scheduleId: string;
  notifId: number;
  kind: 'alarm' | 'reminder' | 'calm';
  entityId?: string;
  title: string;
  body?: string;
  soundId?: string;
  soundPath?: string;
  soundName?: string;
  route?: AppRoute;
  snoozeMinutes?: number;
  isTest?: boolean;
  slotKey?: string;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await SanctuaryAudio.startRingtone(params);
    return res.started;
  } catch {
    return false;
  }
}

export async function stopNativeRingtone(notifId?: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SanctuaryAudio.stopRingtone({ notifId });
  } catch {
    // ignore
  }
}

export async function playNativeChime(params: {
  soundId?: string;
  soundPath?: string;
  maxMs?: number;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await SanctuaryAudio.playChime(params);
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeChime(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SanctuaryAudio.stopChime();
  } catch {
    // ignore
  }
}

export async function tryClaimNativeSlot(slotKey: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await SanctuaryAudio.tryClaimSlot({ slotKey });
    return res.claimed;
  } catch {
    return true;
  }
}

export async function drainNativePendingEvents(): Promise<{
  events: NativeAlertEvent[];
  pendingRoute?: AppRoute;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { events: [] };
  }
  try {
    return await SanctuaryAudio.drainPendingEvents();
  } catch {
    return { events: [] };
  }
}

export async function getNativeAudioDiagnostics(): Promise<AudioDiagnostics | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await SanctuaryAudio.getAudioDiagnostics();
  } catch {
    return null;
  }
}

export async function openNativeExactAlarmSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SanctuaryAudio.openExactAlarmSettings();
  } catch {
    // ignore
  }
}

export function attachNativeAudioListeners(callbacks: {
  onAlertEvent: (event: NativeAlertEvent) => void;
  onRouteIntent: (route: AppRoute) => void;
}): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let removed = false;
  const alertHandle = SanctuaryAudio.addListener('nativeAlertEvent', (ev) => {
    if (!removed) callbacks.onAlertEvent(ev);
  }).catch(() => null);

  const routeHandle = SanctuaryAudio.addListener('routeIntent', (ev) => {
    if (!removed && ev?.route) callbacks.onRouteIntent(ev.route);
  }).catch(() => null);

  return () => {
    removed = true;
    void alertHandle.then((h) => h?.remove());
    void routeHandle.then((h) => h?.remove());
  };
}

export async function exportToDevicePublicStorage(params: {
  filename: string;
  mimeType: string;
  folderType: 'image' | 'video' | 'backup' | 'document';
  sourcePath?: string;
  blob?: Blob;
  textContent?: string;
}): Promise<ExportToDeviceResult> {
  const { filename, mimeType, folderType, sourcePath, blob, textContent } = params;

  if (Capacitor.isNativePlatform()) {
    try {
      let base64Data: string | undefined;
      if (!sourcePath && textContent === undefined && blob) {
        const buf = await blob.arrayBuffer();
        base64Data = arrayBufferToBase64(buf);
      }
      const res = await SanctuaryAudio.exportToDeviceStorage({
        filename,
        mimeType,
        folderType,
        ...(sourcePath ? { sourcePath } : {}),
        ...(textContent !== undefined ? { textContent } : {}),
        ...(base64Data ? { base64Data } : {}),
      });
      return {
        ok: Boolean(res.ok),
        uri: res.uri,
        displayPath: res.displayPath,
      };
    } catch (err) {
      return {
        ok: false,
        displayPath: '',
        error: err instanceof Error ? err.message : 'Could not save file to device storage.',
      };
    }
  }

  // Web browser fallback download
  try {
    const outBlob =
      blob ??
      (textContent !== undefined
        ? new Blob([textContent], { type: mimeType })
        : null);
    if (!outBlob) {
      return {
        ok: false,
        displayPath: '',
        error: 'No file data available to download.',
      };
    }
    const url = URL.createObjectURL(outBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return {
      ok: true,
      displayPath: `Downloads/${filename}`,
    };
  } catch (err) {
    return {
      ok: false,
      displayPath: '',
      error: err instanceof Error ? err.message : 'Browser download failed.',
    };
  }
}
