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
