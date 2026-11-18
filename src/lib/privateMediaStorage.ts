import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { PrivateMediaItem } from '../types/sanctuary';
import { createId } from './storage';

const MEDIA_DIR = 'private_sanctuary_media';
// Multiple of 3 bytes so base64 chunk encoding stays cleanly padded between appendFile calls
const CHUNK_BYTE_SIZE = 512 * 1023;

let nomediaEnsured = false;

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

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] || '' : base64;
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function ensurePrivateMediaDirectory(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.mkdir({
      directory: Directory.Data,
      path: MEDIA_DIR,
      recursive: true,
    });
  } catch {
    // Directory already exists
  }

  if (!nomediaEnsured) {
    try {
      await Filesystem.writeFile({
        directory: Directory.Data,
        path: `${MEDIA_DIR}/.nomedia`,
        data: '',
        encoding: Encoding.UTF8,
        recursive: true,
      });
      nomediaEnsured = true;
    } catch {
      // ignore .nomedia write errors
    }
  }
}

async function writeChunkedToNativePrivateStorage(file: File, storagePath: string): Promise<void> {
  await ensurePrivateMediaDirectory();

  if (file.size === 0) {
    await Filesystem.writeFile({
      directory: Directory.Data,
      path: storagePath,
      data: '',
      recursive: true,
    });
    return;
  }

  let offset = 0;
  let isFirstChunk = true;

  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_BYTE_SIZE, file.size);
    const chunkBuf = await file.slice(offset, end).arrayBuffer();
    const base64Chunk = arrayBufferToBase64(chunkBuf);

    if (isFirstChunk) {
      await Filesystem.writeFile({
        directory: Directory.Data,
        path: storagePath,
        data: base64Chunk,
        recursive: true,
      });
      isFirstChunk = false;
    } else {
      await Filesystem.appendFile({
        directory: Directory.Data,
        path: storagePath,
        data: base64Chunk,
      });
    }

    offset = end;
  }
}

/**
 * Copies an imported photo or video immediately into app-private storage:
 * - On Android/iOS native: writes bytes inside app-private Directory.Data
 *   (`private_sanctuary_media/<id>.mwm` + `.nomedia`), completely hidden from
 *   the device Gallery/Albums app and independent of external internal storage.
 * - On Web: reads all bytes into a standalone ArrayBuffer-backed Blob so it is
 *   decoupled from the file picker reference.
 */
export async function importPrivateMediaFile(
  file: File,
  albumId: string
): Promise<PrivateMediaItem> {
  const id = createId('media');
  const inferredKind: 'image' | 'video' = file.type.startsWith('video/')
    ? 'video'
    : file.type.startsWith('image/')
      ? 'image'
      : /\.(mp4|mov|m4v|webm|mkv|3gp|avi)$/i.test(file.name)
        ? 'video'
        : 'image';
  const mimeType =
    file.type || (inferredKind === 'video' ? 'video/mp4' : 'image/jpeg');

  if (Capacitor.isNativePlatform()) {
    const storagePath = `${MEDIA_DIR}/${id}.mwm`;
    try {
      await writeChunkedToNativePrivateStorage(file, storagePath);
      return {
        id,
        albumId,
        name: file.name,
        mimeType,
        kind: inferredKind,
        sizeBytes: file.size,
        storagePath,
        createdAt: new Date().toISOString(),
      };
    } catch {
      // Fallback below: copy bytes into a standalone Blob inside IndexedDB
    }
  }

  const buffer = await file.arrayBuffer();
  const ownedBlob = new Blob([buffer], { type: mimeType });

  return {
    id,
    albumId,
    name: file.name,
    mimeType,
    kind: inferredKind,
    sizeBytes: ownedBlob.size || file.size,
    blob: ownedBlob,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Resolves a displayable in-app Blob object URL for a PrivateMediaItem.
 * Caller is responsible for revoking the returned URL when done.
 */
export async function loadPrivateMediaObjectUrl(item: PrivateMediaItem): Promise<string | null> {
  if (Capacitor.isNativePlatform() && item.storagePath) {
    try {
      const { uri } = await Filesystem.getUri({
        directory: Directory.Data,
        path: item.storagePath,
      });
      const response = await fetch(Capacitor.convertFileSrc(uri));
      if (response.ok) {
        const buf = await response.arrayBuffer();
        const blob = new Blob([buf], { type: item.mimeType || 'application/octet-stream' });
        return URL.createObjectURL(blob);
      }
    } catch {
      // Try direct plugin read fallback below
    }

    try {
      const result = await Filesystem.readFile({
        directory: Directory.Data,
        path: item.storagePath,
      });
      if (typeof result.data === 'string') {
        const bytes = base64ToUint8Array(result.data);
        const safeBytes = new Uint8Array(bytes.byteLength);
        safeBytes.set(bytes);
        const blob = new Blob([safeBytes.buffer], {
          type: item.mimeType || 'application/octet-stream',
        });
        return URL.createObjectURL(blob);
      }
      if (result.data instanceof Blob) {
        return URL.createObjectURL(
          new Blob([result.data], { type: item.mimeType || result.data.type })
        );
      }
    } catch {
      // Fallback to stored blob if present
    }
  }

  if (item.blob) {
    try {
      return URL.createObjectURL(item.blob);
    } catch {
      return null;
    }
  }

  return null;
}

export async function deletePrivateMediaFile(item?: PrivateMediaItem): Promise<void> {
  if (!item?.storagePath || !Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.deleteFile({
      directory: Directory.Data,
      path: item.storagePath,
    });
  } catch {
    // Ignore missing file errors on deletion
  }
}
