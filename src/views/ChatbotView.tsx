import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Send,
  Sparkles,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react';
import type { PersonalNote } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { getApiUrl } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  createdAt: string;
}

interface ChatbotViewProps {
  onSaveToNote: (note: PersonalNote) => Promise<void>;
}

const CHAT_STORAGE_KEY = 'my_world_chatbot_history_v1';

const PERSONA_PRESETS = [
  {
    id: 'companion',
    label: 'Calm Companion',
    instruction:
      'You are a warm, calm, grounded personal sanctuary companion. Listen thoughtfully, avoid overwhelm, and offer clear, reassuring responses.',
  },
  {
    id: 'clarity',
    label: 'Task & Clarity',
    instruction:
      'You help untangle busy thoughts into calm, realistic next steps. Keep suggestions concise, actionable, and humane.',
  },
  {
    id: 'reflection',
    label: 'Evening Reflection',
    instruction:
      'You are a gentle journaling partner helping the user reflect on their day with curiosity and self-kindness.',
  },
  {
    id: 'custom',
    label: 'Custom Instruction',
    instruction: '',
  },
];

export const ChatbotView: React.FC<ChatbotViewProps> = ({ onSaveToNote }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'>(
    'gemini-4-hydrogen'
  );
  const [thinkingLevel, setThinkingLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [presetId, setPresetId] = useState('companion');
  const [customInstruction, setCustomInstruction] = useState(
    'You are a warm, calm personal assistant inside My World.'
  );
  const [showSettings, setShowSettings] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const activeSystemInstruction =
    presetId === 'custom'
      ? customInstruction
      : PERSONA_PRESETS.find((p) => p.id === presetId)?.instruction || '';

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setErrorMsg(null);
    setSavedNotice(null);

    const userMsg: ChatMessage = {
      id: createId('chat'),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    const assistantId = createId('chat');
    const historyForRequest = [...messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: assistantId,
        role: 'model',
        text: '',
        modelUsed: model,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput('');
    setIsStreaming(true);

    try {
      const res = await fetch(getApiUrl('/api/gemini/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForRequest,
          model,
          systemInstruction: activeSystemInstruction,
          thinkingLevel: model === 'gemini-4-hydrogen' ? thinkingLevel : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errJson?.error || `Request failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error('Streaming response body unavailable.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const line = rawEvent.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          const parsed = JSON.parse(jsonStr) as {
            text?: string;
            done?: boolean;
            error?: string;
          };

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + parsed.text } : m
              )
            );
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not complete Gemini chat request.';
      setErrorMsg(msg);
      // Remove empty assistant placeholder on immediate failure
      setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.text.trim())));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSaveReplyToNotes = async (text: string) => {
    const firstLine = text.split('\n')[0]?.slice(0, 48).trim() || 'Sanctuary Chat Note';
    await onSaveToNote({
      id: createId('note'),
      title: firstLine,
      content: text,
      folder: 'Reflections',
      tags: ['gemini-chat'],
      pinned: false,
      isTodoIntent: false,
      checklist: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSavedNotice('Saved response to Personal Notes.');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#BEB4DC]">Multi-Turn Sanctuary Assistant</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Gemini Companion
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1">
            Thoughtful, calm conversations with continuous context and one-tap saving to your
            local notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-[#F1F3F6] inline-flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#BEB4DC]" />
            Tone & Model
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setErrorMsg(null);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-[#F2B8A2] inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear Chat
            </button>
          )}
        </div>
      </header>

      {showSettings && (
        <section className="rounded-3xl bg-[#171A21] border border-[#BEB4DC]/25 p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#98A2B3] block">Model</label>
              <select
                value={model}
                onChange={(e) =>
                  setModel(e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite')
                }
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              >
                <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Balanced & Thoughtful)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
              </select>
            </div>

            {model === 'gemini-4-hydrogen' && (
              <div className="space-y-1.5">
                <label className="text-xs text-[#98A2B3] block">Reasoning Depth</label>
                <select
                  value={thinkingLevel}
                  onChange={(e) =>
                    setThinkingLevel(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
                >
                  <option value="LOW">Low (Quick response)</option>
                  <option value="MEDIUM">Medium (Balanced)</option>
                  <option value="HIGH">High (Deeper reasoning)</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[#98A2B3] block">Companion Tone</label>
            <div className="flex flex-wrap gap-2">
              {PERSONA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId(preset.id)}
                  className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-medium transition-colors ${
                    presetId === preset.id
                      ? 'bg-[#BEB4DC]/20 text-[#BEB4DC] border border-[#BEB4DC]/40'
                      : 'bg-[#1D212A] text-[#98A2B3] border border-white/[0.06]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {presetId === 'custom' && (
            <textarea
              rows={2}
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Write custom system instructions..."
              className="w-full p-3.5 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6] leading-relaxed"
            />
          )}
        </section>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-[#F2B8A2]/10 border border-[#F2B8A2]/30 px-4 py-3 text-xs text-[#F2B8A2]"
        >
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <p className="text-xs text-[#9EC5AB]" role="status">
          {savedNotice}
        </p>
      )}

      {/* Conversation Thread */}
      <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] flex flex-col h-[calc(100dvh-21rem)] min-h-[380px] max-h-[640px]">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#BEB4DC]/15 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#BEB4DC]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-medium text-[#F1F3F6]">
                  Quiet Space to Think
                </h2>
                <p className="text-xs text-[#98A2B3] leading-relaxed">
                  Ask for help organizing a busy day, reframing an anxious thought, or drafting a
                  gentle note.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {[
                  'Help me plan a calm afternoon with 3 priorities',
                  'I feel overwhelmed—help me break things down',
                  'Give me 3 gentle evening reflection questions',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="px-3.5 py-2 rounded-2xl bg-[#1D212A] hover:bg-white/[0.06] border border-white/[0.06] text-xs text-[#D0D5DD] text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-3xl px-4 py-3.5 space-y-2 ${
                      isUser
                        ? 'bg-[#9EC5AB]/15 border border-[#9EC5AB]/25 text-[#F1F3F6]'
                        : 'bg-[#1D212A] border border-white/[0.06] text-[#F1F3F6]'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text || (isStreaming && !isUser ? 'Thinking...' : '')}
                    </p>
                    {!isUser && msg.text && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/[0.05]">
                        <span className="text-[11px] text-[#98A2B3]">
                          {msg.modelUsed || model}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopy(msg.id, msg.text)}
                            className="text-[11px] text-[#98A2B3] hover:text-[#F1F3F6] inline-flex items-center gap-1"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-[#9EC5AB]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveReplyToNotes(msg.text)}
                            className="text-[11px] text-[#9BC4E2] hover:underline inline-flex items-center gap-1"
                          >
                            <BookOpen className="w-3 h-3" />
                            Save to Notes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={threadEndRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="p-3 sm:p-4 border-t border-white/[0.06] flex items-end gap-2.5"
        >
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Share what is on your mind..."
            className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] placeholder-[#98A2B3]/70 resize-none focus:outline-none focus:border-[#BEB4DC]/50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="min-w-[48px] min-h-[44px] px-4 rounded-2xl bg-[#BEB4DC] hover:bg-[#AFA3D4] disabled:opacity-40 text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{isStreaming ? 'Replying' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
