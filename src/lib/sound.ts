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

let audioCtx: AudioContext | null = null;
let alarmLoopTimer: number | null = null;
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

export function startAlarmRinging(
  customTone?: CustomAudioTone | null,
  soundId?: string
) {
  stopAlarmRinging();

  if (customTone?.blob) {
    try {
      const url = URL.createObjectURL(customTone.blob);
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.9;
      activeAlarmObjectUrl = url;
      activeAlarmAudio = audio;
      audio.play().catch(() => {
        // Fallback to synthesized chime if autoplay/codec fails
        stopAlarmRinging();
        playBuiltinById(soundId);
        alarmLoopTimer = window.setInterval(() => playBuiltinById(soundId), 2600);
      });
      return;
    } catch {
      // Fallback below
    }
  }

  playBuiltinById(soundId);
  alarmLoopTimer = window.setInterval(() => {
    playBuiltinById(soundId);
  }, 2600);
}

export function stopAlarmRinging() {
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
