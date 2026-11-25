import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileAudio,
  Mic,
  Square,
  Upload,
} from 'lucide-react';
import type { PersonalNote } from '../types/sanctuary';
import { createId } from '../lib/storage';
import {
  checkGeminiBackendStatus,
  getApiUrl,
  isNativeWithoutBackend,
  type BackendAvailability,
} from '../lib/api';
import { FutureFeatureBanner } from '../components/FutureFeatureBanner';

interface TranscribeViewProps {
  onSaveToNote: (note: PersonalNote) => Promise<void>;
}

interface TranscriptionHistoryItem {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

const HISTORY_KEY = 'my_world_transcriptions_v1';

const PROMPT_MODES = [
  {
    id: 'verbatim',
    label: 'Exact Transcript',
    prompt: 'Transcribe this audio accurately with natural punctuation.',
  },
  {
    id: 'clean',
    label: 'Clean & Structured',
    prompt:
      'Transcribe this audio clearly, removing filler words and organizing paragraphs cleanly.',
  },
  {
    id: 'action',
    label: 'Transcript + Action Items',
    prompt:
      'Provide a clean transcript followed by a short bulleted list of any tasks or action items mentioned.',
  },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TranscribeView: React.FC<TranscribeViewProps> = ({ onSaveToNote }) => {
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLabel, setAudioLabel] = useState('');
  const [promptModeId, setPromptModeId] = useState('verbatim');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendAvailability>(() => ({
    available: !isNativeWithoutBackend(),
    reason: isNativeWithoutBackend() ? 'mobile-not-connected' : undefined,
  }));
  const [history, setHistory] = useState<TranscriptionHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as TranscriptionHistoryItem[]) : [];
    } catch {
      return [];
    }
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    void checkGeminiBackendStatus().then((res) => {
      if (active) setBackendStatus(res);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 15)));
    } catch {
      // ignore storage errors
    }
  }, [history]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioLabel(`Voice Recording (${formatDuration(elapsedSec)})`);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      setElapsedSec(0);
      recorder.start();
      setRecording(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to access microphone.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSavedNotice(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAudioLabel(file.name);
  };

  const handleTranscribe = async () => {
    if (!audioBlob || isTranscribing || !backendStatus.available) return;
    setErrorMsg(null);
    setSavedNotice(null);
    setIsTranscribing(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read audio file.'));
        reader.readAsDataURL(audioBlob);
      });

      const selectedPrompt =
        PROMPT_MODES.find((m) => m.id === promptModeId)?.prompt ||
        PROMPT_MODES[0].prompt;

      const mimeType = audioBlob.type || 'audio/webm';
      const res = await fetch(getApiUrl('/api/gemini/transcribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          prompt: selectedPrompt,
        }),
      });

      const payload = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || `Transcription failed (${res.status})`);
      }

      const text = (payload.text || '').trim();
      setTranscript(text);
      if (text) {
        setHistory((prev) => [
          {
            id: createId('tr'),
            title: audioLabel || 'Audio Memo',
            text,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to transcribe audio.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleSaveAsNote = async () => {
    if (!transcript.trim()) return;
    await onSaveToNote({
      id: createId('note'),
      title: audioLabel || `Voice Memo (${new Date().toLocaleDateString()})`,
      content: transcript,
      folder: 'Voice Memos',
      tags: ['transcription'],
      pinned: false,
      isTodoIntent: false,
      checklist: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSavedNotice('Saved transcript to Personal Notes.');
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2]">Speech-to-Text · Gemini Transcribe</p>
        <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
          Audio Transcription
        </h1>
        <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] mt-1 max-w-2xl">
          Record a voice memo or upload an audio file to convert spoken thoughts into clean text
          and save directly into your Personal Notes.
        </p>
      </header>

      {!backendStatus.available && (
        <FutureFeatureBanner
          title="Audio Transcription — Coming in a Future Update"
          description="Speech-to-text transcription is not yet enabled in this build and will be released in a future update."
          note="Any previously saved local transcripts below can still be viewed, copied, or saved to Notes."
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
        <section className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {!recording ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A68E] text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                Record Voice Memo
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[#F2B8A2]/20 border border-[#F2B8A2]/50 text-[#A6482D] dark:text-[#F2B8A2] text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop · <span className="font-mono-tabular">{formatDuration(elapsedSec)}</span>
              </button>
            )}

            <button
              type="button"
              disabled={recording}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[48px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Upload className="w-4 h-4 text-[#255F8A] dark:text-[#9BC4E2]" />
              Upload Audio
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {audioUrl && (
            <div className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#334155] dark:text-[#D0D5DD]">
                <FileAudio className="w-4 h-4 text-[#255F8A] dark:text-[#9BC4E2] shrink-0" />
                <span className="truncate">{audioLabel}</span>
              </div>
              <audio controls src={audioUrl} className="w-full h-10" />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-[#5B6472] dark:text-[#98A2B3] block">Transcription Style</label>
            <div className="flex flex-wrap gap-2">
              {PROMPT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPromptModeId(m.id)}
                  className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-medium transition-colors ${
                    promptModeId === m.id
                      ? 'bg-[#9BC4E2]/20 text-[#255F8A] dark:text-[#9BC4E2] border border-[#9BC4E2]/40'
                      : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.06]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!backendStatus.available || !audioBlob || recording || isTranscribing}
            onClick={() => void handleTranscribe()}
            className="w-full min-h-[48px] px-5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] disabled:opacity-40 text-[#0F1115] text-sm font-semibold transition-colors"
          >
            {!backendStatus.available
              ? 'Coming in Future Update'
              : isTranscribing
                ? 'Transcribing Audio...'
                : 'Transcribe Audio'}
          </button>
        </section>

        <section className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 flex flex-col justify-between gap-4 min-h-[360px]">
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">Transcript Output</h2>
              {transcript && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="min-h-[38px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] text-xs text-[#334155] dark:text-[#D0D5DD] inline-flex items-center gap-1.5"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[#2E6B48] dark:text-[#9EC5AB]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveAsNote()}
                    className="min-h-[38px] px-3 rounded-xl bg-[#9EC5AB]/15 text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB] inline-flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Save as Note
                  </button>
                </div>
              )}
            </div>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your transcribed voice memo will appear here..."
              className="flex-1 min-h-[220px] w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] text-sm text-[#111827] dark:text-[#F1F3F6] leading-relaxed resize-none focus:outline-none"
            />
          </div>

          {history.length > 0 && (
            <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.06] space-y-2">
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Recent Transcripts</p>
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTranscript(item.text);
                      setAudioLabel(item.title);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-xs text-[#334155] dark:text-[#D0D5DD] max-w-[200px] truncate"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
