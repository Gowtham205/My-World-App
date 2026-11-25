import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import type { PersonalNote } from '../types/sanctuary';
import { createId } from '../lib/storage';
import {
  checkGeminiBackendStatus,
  getLiveWsUrl,
  isNativeWithoutBackend,
  type BackendAvailability,
} from '../lib/api';
import { FutureFeatureBanner } from '../components/FutureFeatureBanner';
import { ModernSelect } from '../components/ModernSelect';

interface TranscriptEntry {
  id: string;
  speaker: 'You' | 'Gemini';
  text: string;
}

interface VoiceLiveViewProps {
  onSaveToNote: (note: PersonalNote) => Promise<void>;
}

const VOICES = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir'] as const;
const PERSONAS = [
  { id: 'calm', label: 'Calm Companion' },
  { id: 'focus', label: 'Focus Coach' },
  { id: 'evening', label: 'Evening Wind-Down' },
] as const;

function floatToPcm16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export const VoiceLiveView: React.FC<VoiceLiveViewProps> = ({ onSaveToNote }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [muted, setMuted] = useState(false);
  const [voice, setVoice] = useState<(typeof VOICES)[number]>('Zephyr');
  const [persona, setPersona] = useState<(typeof PERSONAS)[number]['id']>('calm');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendAvailability>(() => ({
    available: !isNativeWithoutBackend(),
    reason: isNativeWithoutBackend() ? 'mobile-not-connected' : undefined,
  }));

  // Refs for real-time audio callbacks (prevents stale closures)
  const wsRef = useRef<WebSocket | null>(null);
  const mutedRef = useRef(false);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micLevelRef = useRef(0);
  const modelSpeakingRef = useRef(0);
  const visualizerRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    let active = true;
    void checkGeminiBackendStatus().then((res) => {
      if (active) setBackendStatus(res);
    });
    return () => {
      active = false;
    };
  }, []);

  const stopQueuedPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    modelSpeakingRef.current = 0;
  }, []);

  const disconnectSession = useCallback(() => {
    stopQueuedPlayback();
    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    micLevelRef.current = 0;
    modelSpeakingRef.current = 0;
    setStatus('idle');
  }, [stopQueuedPlayback]);

  useEffect(() => {
    return () => disconnectSession();
  }, [disconnectSession]);

  // Ambient reactive breathing ring visualizer
  useEffect(() => {
    let raf = 0;
    let phase = 0;

    const renderWave = () => {
      phase += 0.035;
      const canvas = visualizerRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const energy = Math.min(1, micLevelRef.current * 4 + modelSpeakingRef.current * 0.7);
        modelSpeakingRef.current = Math.max(0, modelSpeakingRef.current - 0.025);

        const baseRadius = Math.min(w, h) * 0.27;
        const pulseRadius = baseRadius + Math.sin(phase) * 5 + energy * 18;

        const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, pulseRadius * 1.45);
        grad.addColorStop(0, status === 'live' ? 'rgba(158, 197, 171, 0.35)' : 'rgba(155, 196, 226, 0.14)');
        grad.addColorStop(1, 'rgba(15, 17, 21, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius * 1.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = status === 'live' ? '#9EC5AB' : '#9BC4E2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(190, 180, 220, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius * 0.72 + Math.cos(phase * 1.3) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(renderWave);
    };

    raf = requestAnimationFrame(renderWave);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const schedule24kHzPcmPlayback = useCallback((base64Audio: string) => {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;

    const float32 = base64Pcm16ToFloat32(base64Audio);
    if (float32.length === 0) return;

    const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
    modelSpeakingRef.current = 0.85;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  }, []);

  const appendTranscript = useCallback((speaker: 'You' | 'Gemini', text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${cleaned}`.trim() },
        ];
      }
      return [...prev, { id: createId('tr'), speaker, text: cleaned }];
    });
  }, []);

  const startLiveSession = async () => {
    if (status !== 'idle' || !backendStatus.available) return;
    setErrorMsg(null);
    setSavedNotice(null);
    setStatus('connecting');

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      const inputCtx = new Ctx({ sampleRate: 16000 });
      const outputCtx = new Ctx({ sampleRate: 24000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      streamRef.current = stream;
      nextStartTimeRef.current = outputCtx.currentTime;

      const params = new URLSearchParams({ voice, persona });
      const ws = new WebSocket(getLiveWsUrl(params));
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          const channel = ev.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < channel.length; i++) {
            sum += channel[i] * channel[i];
          }
          micLevelRef.current = mutedRef.current ? 0 : Math.sqrt(sum / channel.length);

          if (!mutedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            const base64 = floatToPcm16Base64(channel);
            wsRef.current.send(JSON.stringify({ audio: base64 }));
          }
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            ready?: boolean;
            audio?: string;
            inputTranscript?: string;
            outputTranscript?: string;
            interrupted?: boolean;
            error?: string;
            closed?: boolean;
          };

          if (msg.ready) {
            setStatus('live');
          }
          if (msg.error) {
            setErrorMsg(msg.error);
            disconnectSession();
            return;
          }
          if (msg.interrupted) {
            stopQueuedPlayback();
          }
          if (msg.audio) {
            schedule24kHzPcmPlayback(msg.audio);
          }
          if (msg.inputTranscript) {
            appendTranscript('You', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendTranscript('Gemini', msg.outputTranscript);
          }
          if (msg.closed) {
            disconnectSession();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setErrorMsg('WebSocket voice connection failed.');
        disconnectSession();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          disconnectSession();
        }
      };
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Microphone access or audio setup failed.'
      );
      disconnectSession();
    }
  };

  const handleSaveTranscript = async () => {
    if (transcripts.length === 0) return;
    const body = transcripts.map((t) => `${t.speaker}: ${t.text}`).join('\n\n');
    await onSaveToNote({
      id: createId('note'),
      title: `Voice Conversation (${new Date().toLocaleDateString()})`,
      content: body,
      folder: 'Voice Reflections',
      tags: ['gemini-live'],
      pinned: false,
      isTodoIntent: false,
      checklist: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSavedNotice('Saved conversation transcript to Personal Notes.');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">Real-Time Bidirectional Voice · Gemini Live</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            Live Voice Sanctuary
          </h1>
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] mt-1">
            Speak naturally in real time—interrupt anytime, listen calmly, and capture reflections.
          </p>
        </div>

        {transcripts.length > 0 && (
          <button
            type="button"
            onClick={() => void handleSaveTranscript()}
            className="min-h-[44px] px-4 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            Save Transcript to Notes
          </button>
        )}
      </header>

      {!backendStatus.available && (
        <FutureFeatureBanner
          title="Live Voice Sanctuary — Coming in a Future Update"
          description="Real-time voice conversations are not yet enabled in this build and will be released in a future update."
          note="This feature is planned for a future release once cloud voice hosting is enabled."
        />
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-[#F2B8A2]/10 border border-[#F2B8A2]/30 px-4 py-3 text-xs text-[#A6482D] dark:text-[#F2B8A2]"
        >
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]" role="status">
          {savedNotice}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-6 flex flex-col items-center justify-between gap-5">
          <div className="w-full grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#5B6472] dark:text-[#98A2B3] block mb-1">Voice</label>
              <ModernSelect
                ariaLabel="Voice"
                title="Select Voice"
                accent="sage"
                disabled={status !== 'idle'}
                value={voice}
                onChange={(val) => setVoice(val as (typeof VOICES)[number])}
                options={VOICES.map((v) => ({ value: v, label: v }))}
              />
            </div>
            <div>
              <label className="text-xs text-[#5B6472] dark:text-[#98A2B3] block mb-1">Companion Mode</label>
              <ModernSelect
                ariaLabel="Companion Mode"
                title="Companion Mode"
                accent="sage"
                disabled={status !== 'idle'}
                value={persona}
                onChange={(val) =>
                  setPersona(val as (typeof PERSONAS)[number]['id'])
                }
                options={PERSONAS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </div>
          </div>

          <div className="relative flex flex-col items-center justify-center py-2">
            <canvas ref={visualizerRef} width={220} height={220} className="block" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Volume2
                className={`w-7 h-7 ${
                  status === 'live' ? 'text-[#2E6B48] dark:text-[#9EC5AB]' : 'text-[#255F8A] dark:text-[#9BC4E2]'
                }`}
              />
              <span className="text-xs font-medium text-[#334155] dark:text-[#D0D5DD] mt-2">
                {status === 'idle'
                  ? 'Ready'
                  : status === 'connecting'
                    ? 'Connecting...'
                    : muted
                      ? 'Mic Muted'
                      : 'Listening Live'}
              </span>
            </div>
          </div>

          <div className="w-full flex items-center justify-center gap-3">
            {status === 'idle' ? (
              <button
                type="button"
                disabled={!backendStatus.available}
                onClick={() => void startLiveSession()}
                className="flex-1 min-h-[48px] px-5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] disabled:opacity-40 text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                {backendStatus.available ? 'Start Voice Session' : 'Coming in Future Update'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className={`min-h-[48px] px-4 rounded-2xl border text-xs font-medium inline-flex items-center justify-center gap-2 ${
                    muted
                      ? 'bg-[#F2B8A2]/15 border-[#F2B8A2]/40 text-[#A6482D] dark:text-[#F2B8A2]'
                      : 'bg-[#ECEFF3] dark:bg-[#1D212A] border-slate-900/[0.10] dark:border-white/[0.08] text-[#111827] dark:text-[#F1F3F6]'
                  }`}
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {muted ? 'Unmute' : 'Mute Mic'}
                </button>
                <button
                  type="button"
                  onClick={disconnectSession}
                  className="flex-1 min-h-[48px] px-5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A68E] text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </button>
              </>
            )}
          </div>
        </section>

        <section className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 flex flex-col h-[420px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.08] dark:border-white/[0.06]">
            <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">Live Transcript</h2>
            {transcripts.length > 0 && (
              <button
                type="button"
                onClick={() => setTranscripts([])}
                className="text-xs text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pt-4 space-y-3">
            {transcripts.length === 0 ? (
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
                Start a live voice session and speak whenever you are ready. Both your spoken words
                and Gemini’s responses appear here automatically.
              </p>
            ) : (
              transcripts.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.05] p-3.5 space-y-1"
                >
                  <p
                    className={`text-[11px] font-medium ${
                      entry.speaker === 'You' ? 'text-[#255F8A] dark:text-[#9BC4E2]' : 'text-[#2E6B48] dark:text-[#9EC5AB]'
                    }`}
                  >
                    {entry.speaker}
                  </p>
                  <p className="text-xs sm:text-sm text-[#111827] dark:text-[#F1F3F6] leading-relaxed">
                    {entry.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
