// Local-first Web Audio API procedural Soundscapes engine
// Zero external audio files required; generates smooth, click-free stereo ambient soundscapes.

export type SoundscapeId =
  | 'rain'
  | 'forest'
  | 'ocean'
  | 'white-noise'
  | 'brown-noise'
  | 'hearth';

export interface SoundscapeTrack {
  id: SoundscapeId;
  title: string;
  subtitle: string;
  category: 'Nature' | 'Noise' | 'Cozy';
  accentColor: string;
}

export const SOUNDSCAPE_TRACKS: SoundscapeTrack[] = [
  {
    id: 'rain',
    title: 'Gentle Rain',
    subtitle: 'Soft rainfall swells with distant window droplets',
    category: 'Nature',
    accentColor: '#9BC4E2',
  },
  {
    id: 'forest',
    title: 'Misty Forest',
    subtitle: 'Breeze through pine canopies and quiet woodland air',
    category: 'Nature',
    accentColor: '#9EC5AB',
  },
  {
    id: 'ocean',
    title: 'Night Ocean',
    subtitle: 'Slow rhythmic surf rolling softly against the shore',
    category: 'Nature',
    accentColor: '#9BC4E2',
  },
  {
    id: 'white-noise',
    title: 'Soft Pink Noise',
    subtitle: 'Balanced, warm studio noise to mask sharp distractions',
    category: 'Noise',
    accentColor: '#BEB4DC',
  },
  {
    id: 'brown-noise',
    title: 'Deep Brown Noise',
    subtitle: 'Low, enveloping rumble for deep focus and calm',
    category: 'Noise',
    accentColor: '#BEB4DC',
  },
  {
    id: 'hearth',
    title: 'Quiet Hearth',
    subtitle: 'Warm embers and subtle occasional wooden crackles',
    category: 'Cozy',
    accentColor: '#F2B8A2',
  },
];

interface ActiveVoice {
  stop: () => void;
  setVolume: (vol: number) => void;
}

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices: Map<SoundscapeId, ActiveVoice> = new Map();
  private pinkBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;
  private whiteBuffer: AudioBuffer | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.75;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createSeamlessBuffer(
    ctx: AudioContext,
    type: 'white' | 'pink' | 'brown',
    seconds = 6
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      let lastOut = 0;

      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'white') {
          data[i] = white * 0.28;
        } else if (type === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;
          data[i] = pink * 0.08;
        } else {
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 1.8;
        }
      }

      // Crossfade first/last 200ms so looping is 100% seamless with zero clicks
      const fadeSamples = Math.min(Math.floor(sampleRate * 0.2), Math.floor(length / 4));
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const startSample = data[i];
        const endSample = data[length - fadeSamples + i];
        data[i] = startSample * t + endSample * (1 - t);
      }
    }
    return buffer;
  }

  private getBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
    if (type === 'pink') {
      if (!this.pinkBuffer) this.pinkBuffer = this.createSeamlessBuffer(ctx, 'pink');
      return this.pinkBuffer;
    }
    if (type === 'brown') {
      if (!this.brownBuffer) this.brownBuffer = this.createSeamlessBuffer(ctx, 'brown');
      return this.brownBuffer;
    }
    if (!this.whiteBuffer) this.whiteBuffer = this.createSeamlessBuffer(ctx, 'white');
    return this.whiteBuffer;
  }

  private buildVoice(id: SoundscapeId, initialVolume: number): ActiveVoice {
    const ctx = this.ensureContext();
    const outGain = ctx.createGain();
    outGain.gain.setValueAtTime(0.001, ctx.currentTime);
    outGain.gain.linearRampToValueAtTime(initialVolume, ctx.currentTime + 0.35);
    outGain.connect(this.masterGain!);

    const cleanups: (() => void)[] = [];

    const startNoiseLoop = (
      type: 'white' | 'pink' | 'brown',
      configureFilter?: (src: AudioBufferSourceNode) => AudioNode
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.getBuffer(ctx, type);
      src.loop = true;
      const tail = configureFilter ? configureFilter(src) : src;
      tail.connect(outGain);
      src.start();
      cleanups.push(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore already stopped
        }
      });
    };

    if (id === 'rain') {
      startNoiseLoop('pink', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1850;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 220;

        // Subtle rainfall swell LFO
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.09;
        lfoGain.gain.value = 320;
        lfo.connect(lfoGain);
        lfoGain.connect(lp.frequency);
        lfo.start();
        cleanups.push(() => {
          try {
            lfo.stop();
          } catch {
            // ignore
          }
        });

        src.connect(hp);
        hp.connect(lp);
        return lp;
      });

      // Gentle rain droplets
      const dropTimer = window.setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        if (Math.random() > 0.65) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        const baseFreq = 900 + Math.random() * 1400;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.055);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.02, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        osc.connect(g);
        g.connect(outGain);
        osc.start(now);
        osc.stop(now + 0.08);
      }, 240);
      cleanups.push(() => window.clearInterval(dropTimer));
    } else if (id === 'forest') {
      startNoiseLoop('pink', (src) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 540;
        bp.Q.value = 0.85;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.07;
        lfoGain.gain.value = 240;
        lfo.connect(lfoGain);
        lfoGain.connect(bp.frequency);
        lfo.start();
        cleanups.push(() => {
          try {
            lfo.stop();
          } catch {
            // ignore
          }
        });

        src.connect(bp);
        return bp;
      });

      // Occasional soft distant woodland bird notes
      const birdTimer = window.setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        if (Math.random() > 0.4) return;
        const now = ctx.currentTime;
        const notes = [1760, 2093, 2349];
        const freq = notes[Math.floor(Math.random() * notes.length)];
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.14);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.018, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        osc.connect(g);
        g.connect(outGain);
        osc.start(now);
        osc.stop(now + 0.26);
      }, 2800);
      cleanups.push(() => window.clearInterval(birdTimer));
    } else if (id === 'ocean') {
      startNoiseLoop('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 460;

        const waveGain = ctx.createGain();
        waveGain.gain.value = 0.55;

        const lfo = ctx.createOscillator();
        const lfoToFilter = ctx.createGain();
        const lfoToGain = ctx.createGain();
        lfo.frequency.value = 0.11; // ~9s ocean swell
        lfoToFilter.gain.value = 340;
        lfoToGain.gain.value = 0.35;

        lfo.connect(lfoToFilter);
        lfoToFilter.connect(lp.frequency);
        lfo.connect(lfoToGain);
        lfoToGain.connect(waveGain.gain);
        lfo.start();
        cleanups.push(() => {
          try {
            lfo.stop();
          } catch {
            // ignore
          }
        });

        src.connect(lp);
        lp.connect(waveGain);
        return waveGain;
      });
    } else if (id === 'white-noise') {
      startNoiseLoop('pink', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 4800;
        src.connect(lp);
        return lp;
      });
    } else if (id === 'brown-noise') {
      startNoiseLoop('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 280;
        src.connect(lp);
        return lp;
      });
    } else if (id === 'hearth') {
      startNoiseLoop('brown', (src) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 190;
        src.connect(lp);
        return lp;
      });

      const crackleTimer = window.setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        if (Math.random() > 0.55) return;
        const now = ctx.currentTime;
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) {
          ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ch.length * 0.25));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1600 + Math.random() * 1800;
        bp.Q.value = 2.0;
        const g = ctx.createGain();
        g.gain.value = 0.08 + Math.random() * 0.1;
        src.connect(bp);
        bp.connect(g);
        g.connect(outGain);
        src.start(now);
      }, 310);
      cleanups.push(() => window.clearInterval(crackleTimer));
    }

    return {
      setVolume: (vol: number) => {
        if (!this.ctx) return;
        outGain.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.06);
      },
      stop: () => {
        if (this.ctx) {
          outGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        }
        window.setTimeout(() => {
          cleanups.forEach((fn) => fn());
          try {
            outGain.disconnect();
          } catch {
            // ignore
          }
        }, 250);
      },
    };
  }

  startTrack(id: SoundscapeId, volume: number) {
    if (this.voices.has(id)) {
      this.voices.get(id)?.setVolume(volume);
      return;
    }
    const voice = this.buildVoice(id, volume);
    this.voices.set(id, voice);
  }

  stopTrack(id: SoundscapeId) {
    const voice = this.voices.get(id);
    if (voice) {
      voice.stop();
      this.voices.delete(id);
    }
  }

  setTrackVolume(id: SoundscapeId, volume: number) {
    this.voices.get(id)?.setVolume(volume);
  }

  setMasterVolume(volume: number) {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.06);
  }

  stopAll() {
    for (const id of Array.from(this.voices.keys())) {
      this.stopTrack(id);
    }
  }
}

export const soundscapeEngine = new SoundscapeEngine();
