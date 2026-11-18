import React, { useState } from 'react';
import { MapPin, Navigation, Pencil, Play, Plus, Square, Trash2, Wind, X } from 'lucide-react';
import type { EventCalmSession } from '../types/sanctuary';
import { createId } from '../lib/storage';
import {
  buildGoogleMapsDirectionsUrl,
  formatShortDate,
  formatTime12h,
  getTodayStr,
} from '../lib/dateUtils';

interface EventCalmViewProps {
  sessions: EventCalmSession[];
  onSaveSession: (session: EventCalmSession) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onOpenBreathing: (session: EventCalmSession) => void;
  onOpenOnMap?: (venue: string) => void;
}

const BUILT_IN_PROMPTS = [
  "It's okay. You don't have to perform or impress anyone. You are just here to attend, and afterward you can leave.",
  'Step outside for 2 minutes of fresh air and take 3 slow breaths.',
  'Release overthinking—focus only on the present moment.',
  'You are allowed to take quiet pauses whenever the room feels loud.',
];

export const EventCalmView: React.FC<EventCalmViewProps> = ({
  sessions,
  onSaveSession,
  onDeleteSession,
  onOpenBreathing,
  onOpenOnMap,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingSession, setEditingSession] = useState<EventCalmSession | null>(null);
  const [eventName, setEventName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('21:30');
  const [intervalOption, setIntervalOption] = useState<'15' | '20' | '30' | 'midpoint'>('20');
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([
    BUILT_IN_PROMPTS[0],
    BUILT_IN_PROMPTS[1],
  ]);
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [customPrompts, setCustomPrompts] = useState<string[]>([]);

  const toggleBuiltInPrompt = (prompt: string) => {
    setSelectedPrompts((prev) =>
      prev.includes(prompt) ? prev.filter((p) => p !== prompt) : [...prev, prompt]
    );
  };

  const addCustomPrompt = () => {
    if (!customPromptInput.trim()) return;
    setCustomPrompts((prev) => [...prev, customPromptInput.trim()]);
    setCustomPromptInput('');
  };

  const openAddForm = () => {
    setEditingSession(null);
    setEventName('');
    setVenue('');
    setDate(getTodayStr());
    setStartTime('18:00');
    setEndTime('21:30');
    setIntervalOption('20');
    setSelectedPrompts([BUILT_IN_PROMPTS[0], BUILT_IN_PROMPTS[1]]);
    setCustomPrompts([]);
    setCustomPromptInput('');
    setShowAdd((v) => !v);
  };

  const openEditForm = (session: EventCalmSession) => {
    setEditingSession(session);
    setEventName(session.eventName);
    setVenue(session.venue);
    setDate(session.date);
    setStartTime(session.startTime);
    setEndTime(session.endTime);
    setIntervalOption(
      session.isMidpointOnly
        ? 'midpoint'
        : session.intervalMinutes === 15
          ? '15'
          : session.intervalMinutes === 30
            ? '30'
            : '20'
    );
    setSelectedPrompts([...session.selectedPrompts]);
    setCustomPrompts([...session.customPrompts]);
    setCustomPromptInput('');
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    const scheduleChanged =
      !editingSession ||
      editingSession.date !== date ||
      editingSession.startTime !== startTime ||
      editingSession.endTime !== endTime;

    await onSaveSession({
      ...(editingSession || {}),
      id: editingSession ? editingSession.id : createId('evcalm'),
      eventName: eventName.trim(),
      venue: venue.trim(),
      date: date || getTodayStr(),
      startTime,
      endTime,
      intervalMinutes: intervalOption === 'midpoint' ? 0 : Number(intervalOption),
      isMidpointOnly: intervalOption === 'midpoint',
      selectedPrompts:
        selectedPrompts.length > 0 ? selectedPrompts : [BUILT_IN_PROMPTS[0]],
      customPrompts,
      active: editingSession ? editingSession.active : true,
      lastCheckInMinute: scheduleChanged ? undefined : editingSession?.lastCheckInMinute,
      createdAt: editingSession ? editingSession.createdAt : new Date().toISOString(),
    });

    setEditingSession(null);
    setEventName('');
    setVenue('');
    setCustomPrompts([]);
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">Event Calm & Social Anxiety Companion</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            Event Mode
          </h1>
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] mt-1 max-w-2xl">
            Gentle, discreet check-ins and grounding prompts during weddings, gatherings, or busy
            social spaces—with one-tap venue directions.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Event Session
        </button>
      </header>

      {showAdd && (
        <form
          onSubmit={handleSaveForm}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#9EC5AB]/30 p-5 sm:p-7 space-y-5"
        >
          <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
            {editingSession ? 'Edit Event Calm Session' : 'Configure Event Calm Session'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Event name (e.g. Cousin's Wedding Reception)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Venue address or Google Maps link (optional)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Check-In Cadence</label>
              <select
                value={intervalOption}
                onChange={(e) =>
                  setIntervalOption(e.target.value as '15' | '20' | '30' | 'midpoint')
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
              {BUILT_IN_PROMPTS.map((p) => {
                const chosen = selectedPrompts.includes(p);
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
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Add Your Own Personal Reassurance</p>
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
            {customPrompts.map((cp, idx) => (
              <div
                key={`${cp}-${idx}`}
                className="flex items-center justify-between gap-2 pl-2 pr-1 py-1 rounded-xl bg-[#E5E9F0] dark:bg-[#1D212A]/70 text-xs text-[#334155] dark:text-[#D0D5DD]"
              >
                <span>• {cp}</span>
                <button
                  type="button"
                  onClick={() => setCustomPrompts((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove custom reassurance"
                  className="min-w-[32px] min-h-[32px] rounded-lg hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setEditingSession(null);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#9EC5AB] text-[#0F1115] text-sm font-semibold"
            >
              {editingSession ? 'Update Session' : 'Save & Activate'}
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
            No Event Mode sessions yet. Create one before your next gathering so gentle reminders
            are ready.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {sessions.map((session) => {
            const allPrompts = [...session.selectedPrompts, ...session.customPrompts];
            return (
              <article
                key={session.id}
                className={`rounded-3xl bg-white dark:bg-[#171A21] border p-5 sm:p-6 flex flex-col justify-between gap-5 ${
                  session.active ? 'border-[#9EC5AB]/40' : 'border-slate-900/[0.08] dark:border-white/[0.07]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">
                        {session.active ? 'Active Companion' : 'Standby'} ·{' '}
                        {formatShortDate(session.date)} ·{' '}
                        <span className="font-mono-tabular">
                          {formatTime12h(session.startTime)} – {formatTime12h(session.endTime)}
                        </span>
                      </p>
                      <h2 className="font-display text-xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
                        {session.eventName}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(session)}
                        aria-label={`Edit ${session.eventName}`}
                        className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6] flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        aria-label="Delete event session"
                        className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {session.venue && (
                    <p className="text-xs text-[#334155] dark:text-[#D0D5DD] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#255F8A] dark:text-[#9BC4E2] shrink-0" />
                      <span>{session.venue}</span>
                    </p>
                  )}

                  <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                    Check-ins:{' '}
                    {session.isMidpointOnly
                      ? 'Single midpoint check-in'
                      : `Every ${session.intervalMinutes} minutes`}
                  </p>

                  <div className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.05] space-y-2">
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Grounding Prompts ({allPrompts.length})</p>
                    <p className="text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed italic">
                      “{allPrompts[0] || BUILT_IN_PROMPTS[0]}”
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveSession({ ...session, active: !session.active })}
                      className={`min-h-[42px] px-3.5 rounded-2xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        session.active
                          ? 'bg-[#F2B8A2]/15 text-[#A6482D] dark:text-[#F2B8A2]'
                          : 'bg-slate-900/[0.06] dark:bg-white/[0.06] text-[#2E6B48] dark:text-[#9EC5AB]'
                      }`}
                    >
                      {session.active ? (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          Pause Session
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Activate
                        </>
                      )}
                    </button>

                    {session.venue.trim() && (
                      <>
                        {onOpenOnMap && (
                          <button
                            type="button"
                            onClick={() => onOpenOnMap(session.venue)}
                            className="min-h-[42px] px-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Explore Route
                          </button>
                        )}
                        <a
                          href={buildGoogleMapsDirectionsUrl(session.venue)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[42px] px-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Navigate to Venue
                        </a>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenBreathing(session)}
                    className="min-h-[42px] px-4 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Wind className="w-3.5 h-3.5" />
                    Calm Breathing
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
