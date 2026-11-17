import React, { useMemo, useState } from 'react';
import { Copy, Pencil, Pin, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { MotivationalQuote, QuoteMood } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { copyText } from '../lib/share';

// Future-ready QuoteProvider interface so an optional mood-based generator can plug in cleanly later
export interface QuoteProvider {
  name: string;
  getByMood: (mood: QuoteMood | 'All') => Promise<MotivationalQuote[]>;
}

const MOODS: QuoteMood[] = ['Calm', 'Confidence', 'Focus', 'Overthinking', 'Morning'];

interface QuotesViewProps {
  quotes: MotivationalQuote[];
  onSaveQuote: (quote: MotivationalQuote) => Promise<void>;
  onDeleteQuote: (id: string) => Promise<void>;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  quotes,
  onSaveQuote,
  onDeleteQuote,
}) => {
  const [moodFilter, setMoodFilter] = useState<QuoteMood | 'All'>('All');
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingQuote, setEditingQuote] = useState<MotivationalQuote | null>(null);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [mood, setMood] = useState<QuoteMood>('Calm');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => moodFilter === 'All' || q.mood === moodFilter);
  }, [quotes, moodFilter]);

  const spotlightQuote = useMemo(() => {
    if (spotlightId) {
      const found = filteredQuotes.find((q) => q.id === spotlightId);
      if (found) return found;
    }
    return filteredQuotes.find((q) => q.pinnedToHome) || filteredQuotes[0] || null;
  }, [filteredQuotes, spotlightId]);

  const resetForm = () => {
    setEditingQuote(null);
    setText('');
    setAuthor('');
    setMood('Calm');
  };

  const openCreateForm = () => {
    resetForm();
    setShowAdd((v) => !v);
  };

  const openEditForm = (q: MotivationalQuote) => {
    setEditingQuote(q);
    setText(q.text);
    setAuthor(q.author);
    setMood(q.mood);
    setShowAdd(true);
  };

  const handleShuffleByMood = () => {
    if (filteredQuotes.length === 0) return;
    if (filteredQuotes.length === 1) {
      setSpotlightId(filteredQuotes[0].id);
      return;
    }
    const candidates = filteredQuotes.filter((q) => q.id !== spotlightQuote?.id);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (pick) setSpotlightId(pick.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSaveQuote({
      id: editingQuote ? editingQuote.id : createId('quote'),
      text: text.trim(),
      author: author.trim() || 'Personal Note',
      mood,
      pinnedToHome: editingQuote ? editingQuote.pinnedToHome : quotes.length === 0,
      createdAt: editingQuote ? editingQuote.createdAt : new Date().toISOString(),
    });
    resetForm();
    setShowAdd(false);
  };

  const handlePinToHome = async (target: MotivationalQuote) => {
    for (const q of quotes) {
      if (q.pinnedToHome && q.id !== target.id) {
        await onSaveQuote({ ...q, pinnedToHome: false });
      }
    }
    await onSaveQuote({ ...target, pinnedToHome: !target.pinnedToHome });
  };

  const handleCopy = async (q: MotivationalQuote) => {
    const ok = await copyText(`"${q.text}" — ${q.author}`);
    if (ok) {
      setCopiedId(q.id);
      setTimeout(() => setCopiedId(null), 1600);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#BEB4DC]">Motivational Quotes</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Words to Return To
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Save Quote
        </button>
      </header>

      {/* Mood Filter & Shuffle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['All', ...MOODS] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMoodFilter(m);
                setSpotlightId(null);
              }}
              className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                moodFilter === m
                  ? 'bg-[#BEB4DC]/20 text-[#BEB4DC] border border-[#BEB4DC]/30'
                  : 'bg-[#171A21] text-[#98A2B3] border border-white/[0.06] hover:text-[#F1F3F6]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleShuffleByMood}
          className="min-h-[44px] px-4 rounded-2xl bg-[#171A21] hover:bg-white/[0.07] border border-white/[0.08] text-xs font-medium text-[#BEB4DC] flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Shuffle by Mood
        </button>
      </div>

      {/* Spotlight Quote */}
      {spotlightQuote && (
        <section className="rounded-3xl bg-[#171A21] border border-white/[0.08] p-6 sm:p-8">
          <p className="text-xs text-[#BEB4DC] mb-3">
            Spotlight · {spotlightQuote.mood}
            {spotlightQuote.pinnedToHome ? ' · Pinned to Home' : ''}
          </p>
          <blockquote className="font-display text-2xl sm:text-3xl text-[#F1F3F6] leading-relaxed text-balance">
            “{spotlightQuote.text}”
          </blockquote>
          <p className="text-sm text-[#98A2B3] mt-4">— {spotlightQuote.author}</p>
        </section>
      )}

      {/* Add / Edit Quote Form */}
      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-[#171A21] border border-[#BEB4DC]/30 p-5 sm:p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F1F3F6]">
            {editingQuote ? 'Edit Quote' : 'Save a Quote or Grounding Block'}
          </h2>
          <textarea
            rows={3}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a quote, poem excerpt, or personal reminder..."
            className="w-full p-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] leading-relaxed focus:outline-none focus:border-[#BEB4DC]/50"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author or source (optional)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value as QuoteMood)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            >
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  Mood: {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD] whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#BEB4DC] text-[#0F1115] text-sm font-semibold whitespace-nowrap"
            >
              {editingQuote ? 'Update Quote' : 'Save to Collection'}
            </button>
          </div>
        </form>
      )}

      {/* Quote Library */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredQuotes.map((q) => (
          <article
            key={q.id}
            className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 flex flex-col justify-between gap-4"
          >
            <div>
              <p className="text-xs text-[#98A2B3] mb-2">
                {q.mood}
                {q.pinnedToHome ? ' · Pinned to Home' : ''}
              </p>
              <p className="font-display text-lg text-[#F1F3F6] leading-relaxed">“{q.text}”</p>
              <p className="text-xs text-[#98A2B3] mt-3">— {q.author}</p>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handlePinToHome(q)}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  q.pinnedToHome
                    ? 'bg-[#BEB4DC]/15 text-[#BEB4DC]'
                    : 'hover:bg-white/[0.05] text-[#98A2B3]'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                {q.pinnedToHome ? 'Pinned Home' : 'Pin Home'}
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleCopy(q)}
                  className="min-h-[40px] px-3 rounded-xl hover:bg-white/[0.05] text-xs text-[#98A2B3] hover:text-[#F1F3F6] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedId === q.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => openEditForm(q)}
                  aria-label="Edit quote"
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.05] text-[#98A2B3] hover:text-[#9BC4E2] flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteQuote(q.id)}
                  aria-label="Delete quote"
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.05] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
