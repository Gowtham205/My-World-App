import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { EventCalmSession } from '../types/sanctuary';
import { getTodayStr, validateFutureDateTime } from '../lib/dateUtils';
import { createId } from '../lib/storage';

export const BUILT_IN_CALM_PROMPTS = [
  "It's okay. You don't have to perform or impress anyone. You are just here to attend, and afterward you can leave.",
  'Step outside for 2 minutes of fresh air and take 3 slow breaths.',
  'Release overthinking—focus only on the present moment.',
  'You are allowed to take quiet pauses whenever the room feels loud.',
];

export interface EventCalmFormDraft {
  eventName: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  intervalOption: '15' | '20' | '30' | 'midpoint';
  selectedPrompts: string[];
  customPrompts: string[];
}

export function makeEmptyEventCalmDraft(initialDate = getTodayStr()): EventCalmFormDraft {
  return {
    eventName: '',
    venue: '',
    date: initialDate,
    startTime: '18:00',
    endTime: '21:30',
    intervalOption: '20',
    selectedPrompts: [BUILT_IN_CALM_PROMPTS[0], BUILT_IN_CALM_PROMPTS[1]],
    customPrompts: [],
  };
}

export function eventSessionToDraft(session: EventCalmSession): EventCalmFormDraft {
  return {
    eventName: session.eventName,
    venue: session.venue,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    intervalOption: session.isMidpointOnly
      ? 'midpoint'
      : session.intervalMinutes === 15
        ? '15'
        : session.intervalMinutes === 30
          ? '30'
          : '20',
    selectedPrompts: [...session.selectedPrompts],
    customPrompts: [...session.customPrompts],
  };
}

export function validateEventCalmDraft(draft: EventCalmFormDraft): string | null {
  if (!draft.eventName.trim()) {
    return 'Please enter an event name.';
  }
  return validateFutureDateTime({
    date: draft.date,
    time: draft.startTime,
    requireTime: true,
    dateLabel: 'Event Date',
    timeLabel: 'Start Time',
  });
}

export async function persistEventCalmDraft(params: {
  draft: EventCalmFormDraft;
  existingSession?: EventCalmSession | null;
  onSaveSession: (session: EventCalmSession) => Promise<void>;
}): Promise<EventCalmSession | null> {
  const { draft, existingSession, onSaveSession } = params;
  if (!draft.eventName.trim()) return null;

  const cleanDate = draft.date || getTodayStr();
  const scheduleChanged =
    !existingSession ||
    existingSession.date !== cleanDate ||
    existingSession.startTime !== draft.startTime ||
    existingSession.endTime !== draft.endTime;

  const saved: EventCalmSession = {
    ...(existingSession || {}),
    id: existingSession ? existingSession.id : createId('evcalm'),
    eventName: draft.eventName.trim(),
    venue: draft.venue.trim(),
    date: cleanDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    intervalMinutes: draft.intervalOption === 'midpoint' ? 0 : Number(draft.intervalOption),
    isMidpointOnly: draft.intervalOption === 'midpoint',
    selectedPrompts:
      draft.selectedPrompts.length > 0 ? draft.selectedPrompts : [BUILT_IN_CALM_PROMPTS[0]],
    customPrompts: draft.customPrompts,
    active: existingSession ? existingSession.active : true,
    lastCheckInMinute: scheduleChanged ? undefined : existingSession?.lastCheckInMinute,
    createdAt: existingSession ? existingSession.createdAt : new Date().toISOString(),
  };

  await onSaveSession(saved);
  return saved;
}

interface EventCalmFormFieldsProps {
  draft: EventCalmFormDraft;
  onChange: React.Dispatch<React.SetStateAction<EventCalmFormDraft>>;
  validationError?: string | null;
}

export const EventCalmFormFields: React.FC<EventCalmFormFieldsProps> = ({
  draft,
  onChange,
  validationError,
}) => {
  const [customPromptInput, setCustomPromptInput] = useState('');
  const todayStr = getTodayStr();

  const toggleBuiltInPrompt = (prompt: string) => {
    onChange((prev) => ({
      ...prev,
      selectedPrompts: prev.selectedPrompts.includes(prompt)
        ? prev.selectedPrompts.filter((p) => p !== prompt)
        : [...prev.selectedPrompts, prompt],
    }));
  };

  const addCustomPrompt = () => {
    if (!customPromptInput.trim()) return;
    const text = customPromptInput.trim();
    onChange((prev) => ({
      ...prev,
      customPrompts: [...prev.customPrompts, text],
    }));
    setCustomPromptInput('');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={draft.eventName}
          onChange={(e) => onChange((prev) => ({ ...prev, eventName: e.target.value }))}
          placeholder="Event name (e.g. Cousin's Wedding Reception)"
          className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
        />
        <input
          type="text"
          value={draft.venue}
          onChange={(e) => onChange((prev) => ({ ...prev, venue: e.target.value }))}
          placeholder="Venue address or Google Maps link (optional)"
          className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Date</label>
          <input
            type="date"
            min={todayStr}
            value={draft.date}
            onChange={(e) => onChange((prev) => ({ ...prev, date: e.target.value }))}
            className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Start Time</label>
          <input
            type="time"
            required
            value={draft.startTime}
            onChange={(e) => onChange((prev) => ({ ...prev, startTime: e.target.value }))}
            className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">End Time</label>
          <input
            type="time"
            required
            value={draft.endTime}
            onChange={(e) => onChange((prev) => ({ ...prev, endTime: e.target.value }))}
            className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
            Check-In Cadence
          </label>
          <select
            value={draft.intervalOption}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                intervalOption: e.target.value as '15' | '20' | '30' | 'midpoint',
              }))
            }
            className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
          >
            <option value="15">Every 15 minutes</option>
            <option value="20">Every 20 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="midpoint">Single midpoint check-in</option>
          </select>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Select Gentle Grounding Prompts</p>
        <div className="space-y-2">
          {BUILT_IN_CALM_PROMPTS.map((p) => {
            const chosen = draft.selectedPrompts.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggleBuiltInPrompt(p)}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs leading-relaxed transition-colors ${
                  chosen
                    ? 'bg-[#9EC5AB]/10 border-[#9EC5AB]/40 text-[#111827] dark:text-[#F1F3F6]'
                    : 'bg-[#ECEFF3] dark:bg-[#1D212A] border-slate-900/[0.08] dark:border-white/[0.06] text-[#5B6472] dark:text-[#98A2B3]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
          Add Your Own Personal Reassurance
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPromptInput}
            onChange={(e) => setCustomPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomPrompt();
              }
            }}
            placeholder="Write a personal calming note for yourself..."
            className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
          />
          <button
            type="button"
            onClick={addCustomPrompt}
            className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.06] dark:bg-white/[0.06] text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB] whitespace-nowrap"
          >
            Add
          </button>
        </div>
        {draft.customPrompts.map((cp, idx) => (
          <div
            key={`${cp}-${idx}`}
            className="flex items-center justify-between gap-2 pl-2 pr-1 py-1 rounded-xl bg-[#E5E9F0] dark:bg-[#1D212A]/70 text-xs text-[#334155] dark:text-[#D0D5DD]"
          >
            <span>• {cp}</span>
            <button
              type="button"
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  customPrompts: prev.customPrompts.filter((_, i) => i !== idx),
                }))
              }
              aria-label="Remove custom reassurance"
              className="min-w-[32px] min-h-[32px] rounded-lg hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {validationError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FDF1EB] dark:bg-[#2B1C19] border border-[#F2B8A2]/50 px-4 py-3 text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
        >
          {validationError}
        </div>
      )}
    </div>
  );
};
