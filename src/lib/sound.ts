import type { CustomAudioTone } from '../types/sanctuary';

// Web Audio API synthesis + local custom audio file playback for alarms, reminders & notifications

export interface BuiltinToneOption {
  id: string;
  label: string;
  kind: 'alarm' | 'calm';
}

export const BUILTIN_TONES: BuiltinToneOption[] = [
  { id: 'builtin:sanctuary-chime', label: 'Sanctuary Chime (Default)', kind: 'alarm' },
  { id: 'builtin:calm-chime', label: 'Soft Calm Bell', kind: 'calm' },
  { id: 'builtin:sunrise-harp', label: 'Warm Sunrise Arpeggio', kind: 'alarm' },
];

export const ALARM_MAX_RING_MS = 60_000;

let audioCtx: AudioContext | null = null;
let alarmLoopTimer: number | null = null;
let alarmMaxTimeoutTimer: number | null = null;
let activeAlarmAudio: HTMLAudioElement | null = null;
let activeAlarmObjectUrl: string | null = null;
let activePreviewAudio: HTMLAudioElement | null = null;
let activePreviewObjectUrl: string | null = null;
let activePreviewTimeout: number | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function resolveSoundName(
  customTones: CustomAudioTone[],
  soundId?: string
): string {
  if (!soundId) return BUILTIN_TONES[0].label;
  const builtin = BUILTIN_TONES.find((b) => b.id === soundId);
  if (builtin) return builtin.label;
  const custom = customTones.find((c) => c.id === soundId);
  return custom ? custom.name : BUILTIN_TONES[0].label;
}

export function playSanctuaryChime(
  variant: 'calm' | 'alarm' | 'sunrise' = 'calm'
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies =
    variant === 'alarm'
      ? [523.25, 659.25, 783.99]
      : variant === 'sunrise'
        ? [392.0, 493.88, 587.33, 783.99]
        : [432, 540];

  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = variant === 'sunrise' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.2);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.2);
    gain.gain.exponentialRampToValueAtTime(
      variant === 'alarm' ? 0.16 : variant === 'sunrise' ? 0.13 : 0.09,
      now + idx * 0.2 + 0.06
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.2 + 1.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.2);
    osc.stop(now + idx * 0.2 + 1.55);
  });
}

function playBuiltinById(soundId?: string) {
  if (soundId === 'builtin:calm-chime') {
    playSanctuaryChime('calm');
  } else if (soundId === 'builtin:sunrise-harp') {
    playSanctuaryChime('sunrise');
  } else {
    playSanctuaryChime('alarm');
  }
}

const builtinWavBlobCache = new Map<string, Blob>();

function buildBuiltinAlarmWavBlob(soundId?: string): Blob {
  const key = soundId || 'builtin:sanctuary-chime';
  const cached = builtinWavBlobCache.get(key);
  if (cached) return cached;

  const sampleRate = 22050;
  const durationSec = 2.6;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard 16-bit mono PCM WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const notes =
    key === 'builtin:calm-chime'
      ? [432, 540]
      : key === 'builtin:sunrise-harp'
        ? [392.0, 493.88, 587.33, 783.99]
        : [523.25, 659.25, 783.99];

  const isTriangle = key === 'builtin:sunrise-harp';
  const peakAmp = key === 'builtin:calm-chime' ? 0.28 : 0.34;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (let nIdx = 0; nIdx < notes.length; nIdx++) {
      const startT = nIdx * 0.2;
      const localT = t - startT;
      if (localT >= 0 && localT <= 1.55) {
        const attack = Math.min(1, localT / 0.05);
        const decay = Math.exp(-localT * 2.6);
        const freq = notes[nIdx];
        const phase = freq * localT;
        const wave = isTriangle
          ? 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1
          : Math.sin(2 * Math.PI * phase);
        sample += wave * attack * decay * peakAmp;
      }
    }

    const clamped = Math.max(-0.95, Math.min(0.95, sample));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  builtinWavBlobCache.set(key, blob);
  return blob;
}

export function startAlarmRinging(
  customTone?: CustomAudioTone | null,
  soundId?: string,
  options?: { maxDurationMs?: number; onAutoTimeout?: () => void }
) {
  stopSoundPreview();
  stopAlarmRinging();

  const maxDurationMs = options?.maxDurationMs ?? ALARM_MAX_RING_MS;
  if (maxDurationMs > 0) {
    alarmMaxTimeoutTimer = window.setTimeout(() => {
      stopAlarmRinging();
      options?.onAutoTimeout?.();
    }, maxDurationMs);
  }

  // Always prefer HTMLAudioElement (for both custom audio and synthesized built-in WAV)
  // so Android WebView acquires exclusive audio focus and pauses any playing music.
  const audioBlob = customTone?.blob ?? buildBuiltinAlarmWavBlob(soundId);

  try {
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.92;
    activeAlarmObjectUrl = url;
    activeAlarmAudio = audio;
    audio.play().catch(() => {
      // Fallback to Web Audio API synthesis if HTMLAudioElement playback is blocked
      if (activeAlarmAudio) {
        try {
          activeAlarmAudio.pause();
        } catch {
          // ignore
        }
        activeAlarmAudio = null;
      }
      if (activeAlarmObjectUrl) {
        URL.revokeObjectURL(activeAlarmObjectUrl);
        activeAlarmObjectUrl = null;
      }
      playBuiltinById(soundId);
      alarmLoopTimer = window.setInterval(() => playBuiltinById(soundId), 2600);
    });
    return;
  } catch {
    // Fallback below
  }

  playBuiltinById(soundId);
  alarmLoopTimer = window.setInterval(() => {
    playBuiltinById(soundId);
  }, 2600);
}

export function stopAlarmRinging() {
  if (alarmMaxTimeoutTimer !== null) {
    window.clearTimeout(alarmMaxTimeoutTimer);
    alarmMaxTimeoutTimer = null;
  }
  if (alarmLoopTimer !== null) {
    window.clearInterval(alarmLoopTimer);
    alarmLoopTimer = null;
  }
  if (activeAlarmAudio) {
    try {
      activeAlarmAudio.pause();
      activeAlarmAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAlarmAudio = null;
  }
  if (activeAlarmObjectUrl) {
    URL.revokeObjectURL(activeAlarmObjectUrl);
    activeAlarmObjectUrl = null;
  }
}

export function stopSoundPreview() {
  if (activePreviewTimeout !== null) {
    window.clearTimeout(activePreviewTimeout);
    activePreviewTimeout = null;
  }
  if (activePreviewAudio) {
    try {
      activePreviewAudio.pause();
      activePreviewAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activePreviewAudio = null;
  }
  if (activePreviewObjectUrl) {
    URL.revokeObjectURL(activePreviewObjectUrl);
    activePreviewObjectUrl = null;
  }
}

export function previewSoundTone(
  customTones: CustomAudioTone[],
  soundId?: string,
  onEnd?: () => void
) {
  stopSoundPreview();
  const custom = soundId ? customTones.find((t) => t.id === soundId) : undefined;

  if (custom?.blob) {
    try {
      const url = URL.createObjectURL(custom.blob);
      const audio = new Audio(url);
      audio.volume = 0.85;
      activePreviewObjectUrl = url;
      activePreviewAudio = audio;
      audio.onended = () => {
        stopSoundPreview();
        onEnd?.();
      };
      audio.play().catch(() => {
        stopSoundPreview();
        playBuiltinById(soundId);
        onEnd?.();
      });
      return;
    } catch {
      // fallback
    }
  }

  playBuiltinById(soundId);
  activePreviewTimeout = window.setTimeout(() => {
    activePreviewTimeout = null;
    onEnd?.();
  }, 1600);
}

export function playNotificationSound(
  customTones: CustomAudioTone[],
  soundId?: string
) {
  const custom = soundId ? customTones.find((t) => t.id === soundId) : undefined;
  if (custom?.blob) {
    try {
      const url = URL.createObjectURL(custom.blob);
      const audio = new Audio(url);
      audio.volume = 0.8;
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      audio.onended = cleanup;
      // Cap notification/reminder sound playback at 10s so full songs don't play endlessly
      const maxTimer = window.setTimeout(() => {
        try {
          audio.pause();
        } catch {
          // ignore
        }
        cleanup();
      }, 10000);
      audio.addEventListener('ended', () => window.clearTimeout(maxTimer), { once: true });
      audio.play().catch(() => {
        window.clearTimeout(maxTimer);
        cleanup();
        playBuiltinById(soundId || 'builtin:calm-chime');
      });
      return;
    } catch {
      // fallback
    }
  }

  playBuiltinById(soundId || 'builtin:calm-chime');
}
