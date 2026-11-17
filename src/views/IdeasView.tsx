import React, { useMemo, useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import type { CreativeIdeaCard, IdeaBoardType, IdeaCardColor } from '../types/sanctuary';
import { createId } from '../lib/storage';

interface IdeasViewProps {
  ideas: CreativeIdeaCard[];
  onSaveIdea: (idea: CreativeIdeaCard) => Promise<void>;
  onDeleteIdea: (id: string) => Promise<void>;
}

const BOARDS: IdeaBoardType[] = ['Learn', 'Practice', 'Business', 'Projects', 'Moodboard'];
const CARD_COLORS: { id: IdeaCardColor; label: string; bg: string; accent: string }[] = [
  { id: 'sage', label: 'Sage', bg: 'bg-[#17211D]', accent: 'text-[#9EC5AB]' },
  { id: 'lavender', label: 'Lavender', bg: 'bg-[#1D1B27]', accent: 'text-[#BEB4DC]' },
  { id: 'peach', label: 'Peach', bg: 'bg-[#231B1A]', accent: 'text-[#F2B8A2]' },
  { id: 'sky', label: 'Sky', bg: 'bg-[#171F27]', accent: 'text-[#9BC4E2]' },
  { id: 'slate', label: 'Slate', bg: 'bg-[#171A21]', accent: 'text-[#D0D5DD]' },
];

export const IdeasView: React.FC<IdeasViewProps> = ({ ideas, onSaveIdea, onDeleteIdea }) => {
  const [boardFilter, setBoardFilter] = useState<IdeaBoardType | 'All'>('All');
  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [board, setBoard] = useState<IdeaBoardType>('Learn');
  const [color, setColor] = useState<IdeaCardColor>('lavender');
  const [connectTargetId, setConnectTargetId] = useState('');

  const filteredIdeas = useMemo(() => {
    if (boardFilter === 'All') return ideas;
    return ideas.filter((i) => i.board === boardFilter);
  }, [ideas, boardFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newId = createId('idea');
    const newCard: CreativeIdeaCard = {
      id: newId,
      title: title.trim(),
      body: body.trim(),
      board,
      color,
      connectedIds: connectTargetId ? [connectTargetId] : [],
      createdAt: new Date().toISOString(),
    };
    await onSaveIdea(newCard);

    if (connectTargetId) {
      const target = ideas.find((i) => i.id === connectTargetId);
      if (target && !target.connectedIds.includes(newId)) {
        await onSaveIdea({ ...target, connectedIds: [...target.connectedIds, newId] });
      }
    }

    setTitle('');
    setBody('');
    setConnectTargetId('');
    setShowAdd(false);
  };

  const getColorStyle = (c: IdeaCardColor) =>
    CARD_COLORS.find((x) => x.id === c) || CARD_COLORS[4];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#BEB4DC]">Creative Ideas Hub</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Sticky Cards, Moodboards & Sparks
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Idea Card
        </button>
      </header>

      {/* Board Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['All', ...BOARDS] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBoardFilter(b)}
            className={`min-h-[42px] px-4 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              boardFilter === b
                ? 'bg-[#BEB4DC]/20 text-[#BEB4DC] border border-[#BEB4DC]/30'
                : 'bg-[#171A21] text-[#98A2B3] border border-white/[0.06]'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl bg-[#171A21] border border-[#BEB4DC]/30 p-5 sm:p-7 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F1F3F6]">Pin an Idea Card</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. I want to learn watercolor sketching"
              className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value as IdeaBoardType)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            >
              {BOARDS.map((b) => (
                <option key={b} value={b}>
                  Board: {b}
                </option>
              ))}
            </select>
            <select
              value={connectTargetId}
              onChange={(e) => setConnectTargetId(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            >
              <option value="">Connect to another idea (optional)</option>
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>
                  Link with: {i.title}
                </option>
              ))}
            </select>
          </div>

          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Sketch out the concept, steps to practice, or inspiration..."
            className="w-full p-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#98A2B3] mr-1">Card Tone:</span>
            {CARD_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-medium border ${
                  color === c.id
                    ? `${c.bg} ${c.accent} border-white/30`
                    : 'bg-[#1D212A] text-[#98A2B3] border-white/[0.06]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#BEB4DC] text-[#0F1115] text-sm font-semibold"
            >
              Save Idea
            </button>
          </div>
        </form>
      )}

      {/* Visual Moodboard & Sticky Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIdeas.map((card) => {
          const style = getColorStyle(card.color);
          const connectedTitles = card.connectedIds
            .map((cid) => ideas.find((i) => i.id === cid)?.title)
            .filter(Boolean) as string[];

          return (
            <article
              key={card.id}
              className={`rounded-3xl ${style.bg} border border-white/[0.08] overflow-hidden flex flex-col justify-between`}
            >
              {card.imageUrl && (
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#13161C]">
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs ${style.accent}`}>{card.board}</p>
                    <button
                      type="button"
                      onClick={() => onDeleteIdea(card.id)}
                      aria-label="Delete idea card"
                      className="min-w-[36px] min-h-[36px] -mt-1 -mr-1 rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h2 className="font-display text-lg font-medium text-[#F1F3F6] mt-1">
                    {card.title}
                  </h2>

                  {card.body && (
                    <p className="text-sm text-[#D0D5DD] mt-2 leading-relaxed whitespace-pre-wrap">
                      {card.body}
                    </p>
                  )}

                  {card.paletteSwatches && card.paletteSwatches.length > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                      {card.paletteSwatches.map((hex) => (
                        <div
                          key={hex}
                          title={hex}
                          className="w-7 h-7 rounded-xl border border-white/15"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {connectedTitles.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.08] flex items-center gap-1.5 text-xs text-[#98A2B3]">
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Connected: {connectedTitles.join(', ')}</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
