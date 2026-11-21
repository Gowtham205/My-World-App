import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ExternalLink,
  Folder,
  FolderPlus,
  Pencil,
  Pin,
  Plus,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import type { NoteChecklistItem, PersonalNote } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatShortDate } from '../lib/dateUtils';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface NotesViewProps {
  notes: PersonalNote[];
  onSaveNote: (note: PersonalNote) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const DEFAULT_FOLDERS = ['Personal', 'Work', 'Home', 'Links'];
const CUSTOM_FOLDERS_STORAGE_KEY = 'my_world_note_folders_v1';

function loadSavedFolders(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export const NotesView: React.FC<NotesViewProps> = ({ notes, onSaveNote, onDeleteNote }) => {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('All');
  const [savedFolders, setSavedFolders] = useState<string[]>(() => loadSavedFolders());

  // Create-mode vs Inline-edit-mode state
  const [creatingNote, setCreatingNote] = useState<PersonalNote | null>(null);
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null);

  const [newCheckText, setNewCheckText] = useState('');
  const [tagInput, setTagInput] = useState('');

  // Folder creation inside editor or filter bar
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  const [showTopFolderCreator, setShowTopFolderCreator] = useState(false);
  const [topFolderName, setTopFolderName] = useState('');
  const [topFolderError, setTopFolderError] = useState<string | null>(null);

  const [pendingDeleteNote, setPendingDeleteNote] = useState<PersonalNote | null>(null);
  const [pendingDeleteStep, setPendingDeleteStep] = useState<NoteChecklistItem | null>(null);

  const createFormRef = useRef<HTMLFormElement | null>(null);
  const inlineEditFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_FOLDERS_STORAGE_KEY, JSON.stringify(savedFolders));
    } catch {
      // ignore storage quota errors
    }
  }, [savedFolders]);

  const availableFolders = useMemo(() => {
    const byLower = new Map<string, string>();
    const addFolder = (name?: string) => {
      const trimmed = name?.trim();
      if (!trimmed || trimmed.toLowerCase() === 'all') return;
      const key = trimmed.toLowerCase();
      if (!byLower.has(key)) {
        byLower.set(key, trimmed);
      }
    };
    DEFAULT_FOLDERS.forEach(addFolder);
    savedFolders.forEach(addFolder);
    notes.forEach((n) => addFolder(n.folder));
    return Array.from(byLower.values());
  }, [notes, savedFolders]);

  const filterTabs = useMemo(() => ['All', ...availableFolders], [availableFolders]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (folderFilter !== 'All' && n.folder.toLowerCase() !== folderFilter.toLowerCase()) {
          return false;
        }
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

  const resetAuxiliaryInputs = () => {
    setNewCheckText('');
    setTagInput('');
    setShowNewFolderInput(false);
    setNewFolderName('');
    setNewFolderError(null);
  };

  const startNewNote = () => {
    const now = new Date().toISOString();
    setEditingNote(null);
    resetAuxiliaryInputs();
    setCreatingNote({
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
    window.setTimeout(() => {
      createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const startInlineEdit = (note: PersonalNote) => {
    setCreatingNote(null);
    resetAuxiliaryInputs();
    setEditingNote({
      ...note,
      tags: [...note.tags],
      checklist: note.checklist.map((c) => ({ ...c })),
    });
    window.setTimeout(() => {
      inlineEditFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const activeDraft = creatingNote || editingNote;
  const setActiveDraft = (updater: PersonalNote | null) => {
    if (creatingNote) {
      setCreatingNote(updater);
    } else if (editingNote) {
      setEditingNote(updater);
    }
  };

  const tryCreateFolder = (
    rawName: string
  ): { ok: true; folderName: string } | { ok: false; error: string } => {
    const trimmed = rawName.trim();
    if (!trimmed) {
      return { ok: false, error: 'Please enter a folder name.' };
    }
    if (trimmed.toLowerCase() === 'all') {
      return { ok: false, error: '"All" is reserved. Please choose a different folder name.' };
    }
    const existing = availableFolders.find((f) => f.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return {
        ok: false,
        error: `Folder "${existing}" already exists. Please enter a different name.`,
      };
    }
    setSavedFolders((prev) => [...prev, trimmed]);
    return { ok: true, folderName: trimmed };
  };

  const handleCreateInlineFolder = () => {
    if (!activeDraft) return;
    const res = tryCreateFolder(newFolderName);
    if (!res.ok) {
      setNewFolderError(res.error);
      return;
    }
    setActiveDraft({ ...activeDraft, folder: res.folderName });
    setNewFolderName('');
    setNewFolderError(null);
    setShowNewFolderInput(false);
  };

  const handleCreateTopFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const res = tryCreateFolder(topFolderName);
    if (!res.ok) {
      setTopFolderError(res.error);
      return;
    }
    setFolderFilter(res.folderName);
    setTopFolderName('');
    setTopFolderError(null);
    setShowTopFolderCreator(false);
  };

  const handleSave = async (e: React.FormEvent, draft: PersonalNote, isEdit: boolean) => {
    e.preventDefault();
    if (!draft.title.trim() && !draft.content.trim()) return;
    await onSaveNote({
      ...draft,
      title: draft.title.trim() || 'Untitled Note',
      folder: draft.folder.trim() || 'Personal',
      updatedAt: new Date().toISOString(),
    });
    resetAuxiliaryInputs();
    if (isEdit) {
      setEditingNote(null);
    } else {
      setCreatingNote(null);
    }
  };

  const addChecklistItem = () => {
    if (!activeDraft || !newCheckText.trim()) return;
    const item: NoteChecklistItem = {
      id: createId('chk'),
      text: newCheckText.trim(),
      done: false,
    };
    setActiveDraft({ ...activeDraft, checklist: [...activeDraft.checklist, item] });
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

  const renderNoteForm = (
    draft: PersonalNote,
    isEdit: boolean,
    formRef: React.RefObject<HTMLFormElement | null>
  ) => (
    <form
      ref={formRef}
      onSubmit={(e) => void handleSave(e, draft, isEdit)}
      className={`rounded-3xl bg-white dark:bg-[#171A21] border border-[#9BC4E2]/45 p-5 sm:p-7 space-y-4 shadow-xs ${
        isEdit ? 'md:col-span-2' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
          {isEdit ? 'Edit Note' : 'Create Note'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveDraft({ ...draft, isTodoIntent: !draft.isTodoIntent })}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              draft.isTodoIntent
                ? 'bg-[#F2B8A2]/20 text-[#A6482D] dark:text-[#F2B8A2] border border-[#F2B8A2]/30'
                : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#5B6472] dark:text-[#98A2B3]'
            }`}
          >
            {draft.isTodoIntent ? 'I have to do this: Yes' : 'Mark "I have to do this"'}
          </button>
          <button
            type="button"
            onClick={() => setActiveDraft({ ...draft, pinned: !draft.pinned })}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              draft.pinned
                ? 'bg-[#9BC4E2]/20 text-[#255F8A] dark:text-[#9BC4E2]'
                : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#5B6472] dark:text-[#98A2B3]'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            {draft.pinned ? 'Pinned' : 'Pin'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setActiveDraft({ ...draft, title: e.target.value })}
          placeholder="Note title..."
          className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] focus:outline-none focus:border-[#9BC4E2]/50"
        />

        <div className="flex items-center gap-2">
          <select
            aria-label="Note folder"
            value={
              availableFolders.some((f) => f.toLowerCase() === draft.folder.toLowerCase())
                ? availableFolders.find((f) => f.toLowerCase() === draft.folder.toLowerCase())!
                : availableFolders[0] || 'Personal'
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__create_new__') {
                setShowNewFolderInput(true);
                setNewFolderError(null);
              } else {
                setShowNewFolderInput(false);
                setNewFolderError(null);
                setActiveDraft({ ...draft, folder: val });
              }
            }}
            className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] focus:outline-none focus:border-[#9BC4E2]/50"
          >
            {availableFolders.map((folderName) => (
              <option key={folderName} value={folderName}>
                Folder: {folderName}
              </option>
            ))}
            <option value="__create_new__">+ Create New Folder...</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setShowNewFolderInput((v) => !v);
              setNewFolderError(null);
            }}
            title="Create new folder"
            aria-label="Create new folder"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-[#255F8A] dark:text-[#9BC4E2] flex items-center justify-center shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showNewFolderInput && (
        <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#161D26] border border-[#9BC4E2]/35 p-3.5 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                setNewFolderError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateInlineFolder();
                }
              }}
              placeholder="Enter new folder name (different from existing)..."
              className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCreateInlineFolder}
                className="min-h-[42px] px-4 rounded-xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-xs font-semibold whitespace-nowrap"
              >
                Create Folder
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                  setNewFolderError(null);
                }}
                className="min-h-[42px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-xs text-[#5B6472] dark:text-[#98A2B3] whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
          {newFolderError && (
            <p role="alert" className="text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]">
              {newFolderError}
            </p>
          )}
        </div>
      )}

      <textarea
        rows={4}
        value={draft.content}
        onChange={(e) => setActiveDraft({ ...draft, content: e.target.value })}
        placeholder="Write thoughts, paste links (https://...), or capture ideas..."
        className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] leading-relaxed focus:outline-none focus:border-[#9BC4E2]/50"
      />

      {/* Checklist Builder */}
      <div className="space-y-2.5">
        <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Interactive Checklist</p>
        {draft.checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input
              type="text"
              value={item.text}
              onChange={(e) =>
                setActiveDraft({
                  ...draft,
                  checklist: draft.checklist.map((c) =>
                    c.id === item.id ? { ...c, text: e.target.value } : c
                  ),
                })
              }
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] text-xs text-[#111827] dark:text-[#F1F3F6]"
            />
            <button
              type="button"
              onClick={() => setPendingDeleteStep(item)}
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
              if (!draft.tags.includes(clean)) {
                setActiveDraft({ ...draft, tags: [...draft.tags, clean] });
              }
              setTagInput('');
            }
          }}
          placeholder="Type tag & press Enter..."
          className="min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
        />
        {draft.tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() =>
              setActiveDraft({ ...draft, tags: draft.tags.filter((t) => t !== tag) })
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
          onClick={() => {
            resetAuxiliaryInputs();
            if (isEdit) {
              setEditingNote(null);
            } else {
              setCreatingNote(null);
            }
          }}
          className="min-h-[44px] px-4 py-2 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-[44px] px-5 py-2 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold whitespace-nowrap"
        >
          {isEdit ? 'Update Note' : 'Save Note'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#255F8A] dark:text-[#9BC4E2]">Personal Notes</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            Thoughts, Links & Checklists
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowTopFolderCreator((v) => !v);
              setTopFolderError(null);
            }}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
          <button
            type="button"
            onClick={startNewNote}
            className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </header>

      {showTopFolderCreator && (
        <form
          onSubmit={handleCreateTopFolder}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#9BC4E2]/35 p-4 sm:p-5 space-y-2.5"
        >
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={topFolderName}
              onChange={(e) => {
                setTopFolderName(e.target.value);
                setTopFolderError(null);
              }}
              placeholder="New folder name (e.g. Gratitude, Reading List, Travel)..."
              className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold whitespace-nowrap"
              >
                Create Folder
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTopFolderCreator(false);
                  setTopFolderName('');
                  setTopFolderError(null);
                }}
                className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
              >
                Cancel
              </button>
            </div>
          </div>
          {topFolderError && (
            <p role="alert" className="text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]">
              {topFolderError}
            </p>
          )}
        </form>
      )}

      {/* Search & Folder Filter */}
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
          {filterTabs.map((folder) => (
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

      {/* Create Form (Top, when creating a brand new note) */}
      {creatingNote && renderNoteForm(creatingNote, false, createFormRef)}

      {/* Notes Grid (Inline Edit opens right in place of the clicked note card) */}
      {filteredNotes.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
            No notes match this filter yet. Tap “New Note” to write down a thought or save a link.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            if (editingNote && editingNote.id === note.id) {
              return (
                <React.Fragment key={note.id}>
                  {renderNoteForm(editingNote, true, inlineEditFormRef)}
                </React.Fragment>
              );
            }

            return (
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
                        onClick={() => setPendingDeleteNote(note)}
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
                    onClick={() => startInlineEdit(note)}
                    className="min-h-[38px] px-3 rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteNote)}
        title="Delete Note?"
        message={
          pendingDeleteNote
            ? `Are you sure you want to delete "${pendingDeleteNote.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pendingDeleteNote) return;
          const id = pendingDeleteNote.id;
          setPendingDeleteNote(null);
          if (editingNote?.id === id) setEditingNote(null);
          await onDeleteNote(id);
        }}
        onCancel={() => setPendingDeleteNote(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteStep)}
        title="Remove Checklist Step?"
        message={
          pendingDeleteStep
            ? `Are you sure you want to remove "${pendingDeleteStep.text || 'this checklist step'}"?`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (!pendingDeleteStep || !activeDraft) return;
          const stepId = pendingDeleteStep.id;
          setPendingDeleteStep(null);
          setActiveDraft({
            ...activeDraft,
            checklist: activeDraft.checklist.filter((c) => c.id !== stepId),
          });
        }}
        onCancel={() => setPendingDeleteStep(null)}
      />
    </div>
  );
};
