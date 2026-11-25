import { Capacitor } from '@capacitor/core';

/**
 * Resolves backend API and WebSocket URLs.
 *
 * - On standard web deployments, returns relative URLs ('/api/...') and same-host WebSockets.
 * - Inside a standalone Capacitor Android APK, set VITE_API_BASE_URL at build time
 *   (e.g. https://your-hosted-my-world-server.run.app) so Gemini chat, transcription,
 *   and live voice connect to your deployed Express server.
 */

function getConfiguredBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

export function isNativeWithoutBackend(): boolean {
  return Capacitor.isNativePlatform() && !getConfiguredBaseUrl();
}

export function hasGoogleMapsKey(): boolean {
  return Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim());
}

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getConfiguredBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function getLiveWsUrl(queryParams: URLSearchParams): string {
  const base = getConfiguredBaseUrl();
  if (base) {
    const parsed = new URL(base);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}/live?${queryParams.toString()}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/live?${queryParams.toString()}`;
}

export interface BackendAvailability {
  available: boolean;
  reason?: 'mobile-not-connected' | 'unavailable';
}

export async function checkGeminiBackendStatus(): Promise<BackendAvailability> {
  if (isNativeWithoutBackend()) {
    return { available: false, reason: 'mobile-not-connected' };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(getApiUrl('/api/health'), {
      method: 'GET',
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { available: false, reason: 'unavailable' };
    }
    const data = (await res.json()) as { ok?: boolean; hasGeminiKey?: boolean };
    if (!data.ok || !data.hasGeminiKey) {
      return { available: false, reason: 'unavailable' };
    }
    return { available: true };
  } catch {
    return {
      available: false,
      reason: Capacitor.isNativePlatform() ? 'mobile-not-connected' : 'unavailable',
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
