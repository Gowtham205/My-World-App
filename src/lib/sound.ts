// Pure Web Audio API sound synthesis for gentle alarms & Event Calm Mode chimes

let audioCtx: AudioContext | null = null;
let alarmLoopTimer: number | null = null;

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

export function playSanctuaryChime(variant: 'calm' | 'alarm' = 'calm') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = variant === 'alarm' ? [523.25, 659.25, 783.99] : [432, 540];

  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.22);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.22);
    gain.gain.exponentialRampToValueAtTime(
      variant === 'alarm' ? 0.16 : 0.09,
      now + idx * 0.22 + 0.06
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.22 + 1.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.22);
    osc.stop(now + idx * 0.22 + 1.5);
  });
}

export function startAlarmRinging() {
  stopAlarmRinging();
  playSanctuaryChime('alarm');
  alarmLoopTimer = window.setInterval(() => {
    playSanctuaryChime('alarm');
  }, 2600);
}

export function stopAlarmRinging() {
  if (alarmLoopTimer !== null) {
    window.clearInterval(alarmLoopTimer);
    alarmLoopTimer = null;
  }
}
