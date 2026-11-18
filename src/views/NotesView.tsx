import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  ExternalLink,
  Folder,
  Pin,
  Plus,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import type { NoteChecklistItem, PersonalNote } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatShortDate } from '../lib/dateUtils';

interface NotesViewProps {
  notes: PersonalNote[];
  onSaveNote: (note: PersonalNote) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export const NotesView: React.FC<NotesViewProps> = ({ notes, onSaveNote, onDeleteNote }) => {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('All');
  const [editing, setEditing] = useState<PersonalNote | null>(null);
  const [newCheckText, setNewCheckText] = useState('');
  const [tagInput, setTagInput] = useState('');

  const folders = useMemo(() => {
    const set = new Set<string>(['Personal', 'Work', 'Home', 'Links']);
    notes.forEach((n) => {
      if (n.folder) set.add(n.folder);
    });
    return ['All', ...Array.from(set)];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (folderFilter !== 'All' && n.folder !== folderFilter) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, search, folderFilter]);

  const startNewNote = () => {
    const now = new Date().toISOString();
    setEditing({
      id: createId('note'),
      title: '',
      content: '',
      folder: folderFilter === 'All' ? 'Personal' : folderFilter,
      tags: [],
      pinned: false,
      isTodoIntent: false,
      checklist: [],
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() && !editing.content.trim()) return;
    await onSaveNote({
      ...editing,
      title: editing.title.trim() || 'Untitled Note',
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  };

  const addChecklistItem = () => {
    if (!editing || !newCheckText.trim()) return;
    const item: NoteChecklistItem = {
      id: createId('chk'),
      text: newCheckText.trim(),
      done: false,
    };
    setEditing({ ...editing, checklist: [...editing.checklist, item] });
    setNewCheckText('');
  };

  const toggleChecklistInCard = async (note: PersonalNote, itemId: string) => {
    const updated: PersonalNote = {
      ...note,
      checklist: note.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
      updatedAt: new Date().toISOString(),
    };
    await onSaveNote(updated);
  };

  const renderContentWithLinks = (text: string) => {
    const parts = text.split(URL_REGEX);
    return parts.map((part, idx) => {
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#255F8A] dark:text-[#9BC4E2] hover:underline inline-flex items-center gap-1 break-all"
          >
            {part}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#255F8A] dark:text-[#9BC4E2]">Personal Notes</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            Thoughts, Links & Checklists
          </h1>
        </div>
        <button
          type="button"
          onClick={startNewNote}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </header>

      {/* Search & Folder Tabs */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, tags, or saved links..."
            className="w-full min-h-[44px] pl-11 pr-4 rounded-2xl bg-white dark:bg-[#171A21] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] placeholder-[#5B6472]/70 dark:placeholder-[#98A2B3]/70 focus:outline-none focus:border-[#9BC4E2]/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setFolderFilter(folder)}
              className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                folderFilter === folder
                  ? 'bg-[#9BC4E2]/20 text-[#255F8A] dark:text-[#9BC4E2] border border-[#9BC4E2]/30'
                  : 'bg-white dark:bg-[#171A21] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.06] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
              }`}
            >
              {folder}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Modal / Panel */}
      {editing && (
        <form
          onSubmit={handleSave}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#9BC4E2]/30 p-5 sm:p-7 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
              {notes.some((n) => n.id === editing.id) ? 'Edit Note' : 'Create Note'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing({ ...editing, isTodoIntent: !editing.isTodoIntent })}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  editing.isTodoIntent
                    ? 'bg-[#F2B8A2]/20 text-[#A6482D] dark:text-[#F2B8A2] border border-[#F2B8A2]/30'
                    : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#5B6472] dark:text-[#98A2B3]'
                }`}
              >
                {editing.isTodoIntent ? 'I have to do this: Yes' : 'Mark "I have to do this"'}
              </button>
              <button
                type="button"
                onClick={() => setEditing({ ...editing, pinned: !editing.pinned })}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  editing.pinned
                    ? 'bg-[#9BC4E2]/20 text-[#255F8A] dark:text-[#9BC4E2]'
                    : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#5B6472] dark:text-[#98A2B3]'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                {editing.pinned ? 'Pinned' : 'Pin'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Note title..."
              className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] focus:outline-none focus:border-[#9BC4E2]/50"
            />
            <input
              type="text"
              value={editing.folder}
              onChange={(e) => setEditing({ ...editing, folder: e.target.value })}
              placeholder="Folder (e.g. Personal)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] focus:outline-none focus:border-[#9BC4E2]/50"
            />
          </div>

          <textarea
            rows={4}
            value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            placeholder="Write thoughts, paste links (https://...), or capture ideas..."
            className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] leading-relaxed focus:outline-none focus:border-[#9BC4E2]/50"
          />

          {/* Checklist Builder */}
          <div className="space-y-2.5">
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Interactive Checklist</p>
            {editing.checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      checklist: editing.checklist.map((c) =>
                        c.id === item.id ? { ...c, text: e.target.value } : c
                      ),
                    })
                  }
                  className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] text-xs text-[#111827] dark:text-[#F1F3F6]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      checklist: editing.checklist.filter((c) => c.id !== item.id),
                    })
                  }
                  aria-label="Remove checklist item"
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Add checklist step..."
                className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.06] dark:bg-white/[0.06] hover:bg-slate-900/[0.10] dark:hover:bg-white/[0.1] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] whitespace-nowrap"
              >
                Add Step
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  e.preventDefault();
                  const clean = tagInput.trim().toLowerCase();
                  if (!editing.tags.includes(clean)) {
                    setEditing({ ...editing, tags: [...editing.tags, clean] });
                  }
                  setTagInput('');
                }
              }}
              placeholder="Type tag & press Enter..."
              className="min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
            />
            {editing.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setEditing({ ...editing, tags: editing.tags.filter((t) => t !== tag) })
                }
                className="text-xs text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2]"
              >
                #{tag} ×
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold whitespace-nowrap"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
            No notes match this filter yet. Tap “New Note” to write down a thought or save a link.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <article
              key={note.id}
              className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] flex items-center gap-1.5 flex-wrap">
                      <Folder className="w-3.5 h-3.5 text-[#255F8A] dark:text-[#9BC4E2]" />
                      <span>{note.folder}</span>
                      {note.isTodoIntent && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#A6482D] dark:text-[#F2B8A2]">I have to do this</span>
                        </>
                      )}
                      {note.pinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#255F8A] dark:text-[#9BC4E2]">Pinned</span>
                        </>
                      )}
                    </p>
                    <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6] mt-1">
                      {note.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSaveNote({ ...note, pinned: !note.pinned })}
                      aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2]"
                    >
                      <Pin className={`w-4 h-4 ${note.pinned ? 'text-[#255F8A] dark:text-[#9BC4E2]' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      aria-label="Delete note"
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {note.content && (
                  <p className="text-sm text-[#334155] dark:text-[#D0D5DD] whitespace-pre-wrap leading-relaxed">
                    {renderContentWithLinks(note.content)}
                  </p>
                )}

                {note.checklist.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {note.checklist.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleChecklistInCard(note, item.id)}
                        className="w-full min-h-[38px] text-left flex items-center gap-2.5 text-sm text-[#334155] dark:text-[#D0D5DD] hover:text-[#111827] dark:hover:text-white transition-colors"
                      >
                        {item.done ? (
                          <CheckSquare className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] shrink-0" />
                        )}
                        <span className={item.done ? 'line-through text-[#5B6472] dark:text-[#98A2B3]' : ''}>
                          {item.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.06] flex items-center justify-between gap-3">
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] truncate">
                  {note.tags.length > 0
                    ? note.tags.map((t) => `#${t}`).join(' · ')
                    : `Updated ${formatShortDate(note.updatedAt.slice(0, 10))}`}
                </p>
                <button
                  type="button"
                  onClick={() => setEditing(note)}
                  className="min-h-[38px] px-3 rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] whitespace-nowrap"
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
