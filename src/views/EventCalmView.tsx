import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Pencil, Play, Plus, Square, Trash2, Wind } from 'lucide-react';
import type { EventCalmSession } from '../types/sanctuary';
import {
  buildGoogleMapsDirectionsUrl,
  formatShortDate,
  formatTime12h,
} from '../lib/dateUtils';
import {
  BUILT_IN_CALM_PROMPTS,
  EventCalmFormFields,
  eventSessionToDraft,
  makeEmptyEventCalmDraft,
  persistEventCalmDraft,
  validateEventCalmDraft,
  type EventCalmFormDraft,
} from '../components/EventCalmFormFields';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface EventCalmViewProps {
  sessions: EventCalmSession[];
  onSaveSession: (session: EventCalmSession) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onOpenBreathing: (session: EventCalmSession) => void;
  onOpenOnMap?: (venue: string) => void;
}

export const EventCalmView: React.FC<EventCalmViewProps> = ({
  sessions,
  onSaveSession,
  onDeleteSession,
  onOpenBreathing,
  onOpenOnMap,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingSession, setEditingSession] = useState<EventCalmSession | null>(null);
  const [draft, setDraft] = useState<EventCalmFormDraft>(() => makeEmptyEventCalmDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<EventCalmSession | null>(null);
  const inlineEditFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (editingSession?.id) {
      inlineEditFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [editingSession?.id]);

  const openAddForm = () => {
    setEditingSession(null);
    setFormError(null);
    setDraft(makeEmptyEventCalmDraft());
    setShowAdd((v) => !v);
  };

  const openEditForm = (session: EventCalmSession) => {
    setShowAdd(false);
    setEditingSession(session);
    setFormError(null);
    setDraft(eventSessionToDraft(session));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEventCalmDraft(draft, {
      skipPastValidation: Boolean(editingSession),
    });
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);

    await persistEventCalmDraft({
      draft,
      existingSession: editingSession,
      onSaveSession,
    });

    setEditingSession(null);
    setDraft(makeEmptyEventCalmDraft());
    setShowAdd(false);
  };

  const renderSessionForm = (isInlineEdit: boolean) => (
    <form
      ref={isInlineEdit ? inlineEditFormRef : undefined}
      onSubmit={(e) => void handleSaveForm(e)}
      className={`rounded-3xl bg-white/95 dark:bg-[#181C26]/95 border border-[#9EC5AB]/50 dark:border-[#9EC5AB]/30 p-5 sm:p-7 space-y-5 shadow-sm ${
        isInlineEdit ? 'lg:col-span-2' : ''
      }`}
    >
      <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
        {editingSession ? 'Edit Event Calm Session' : 'Configure Event Calm Session'}
      </h2>

      <EventCalmFormFields
        draft={draft}
        onChange={(updater) => {
          setFormError(null);
          setDraft(updater);
        }}
        validationError={formError}
        allowPastDates={Boolean(editingSession)}
      />

      <div className="flex justify-end gap-2.5 pt-2">
        <button
          type="button"
          onClick={() => {
            setShowAdd(false);
            setEditingSession(null);
            setFormError(null);
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
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#ECF6F0] via-[#F5FAF7] to-[#EEF5FB] dark:from-[#172420] dark:via-[#161F22] dark:to-[#17212B] border border-[#9EC5AB]/40 dark:border-[#9EC5AB]/25 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 shadow-xs">
        <div>
          <p className="text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB]">
            Event Calm & Social Anxiety Companion
          </p>
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
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Event Session
        </button>
      </header>

      {showAdd && !editingSession && renderSessionForm(false)}

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
            if (editingSession?.id === session.id) {
              return <React.Fragment key={session.id}>{renderSessionForm(true)}</React.Fragment>;
            }
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
                        onClick={() => setPendingDeleteSession(session)}
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
                      : `Every ${session.intervalMinutes} minutes`}{' '}
                    · Plays calm chime &amp; shows full prompts
                  </p>

                  <div className="p-4 rounded-2xl bg-[#F3F8F5] dark:bg-[#1D212A] border border-[#9EC5AB]/25 dark:border-white/[0.06] space-y-2">
                    <p className="text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB]">
                      Selected Grounding Prompts ({allPrompts.length})
                    </p>
                    <ul className="space-y-1.5 text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
                      {(allPrompts.length > 0 ? allPrompts : [BUILT_IN_CALM_PROMPTS[0]]).map(
                        (promptItem, pIdx) => (
                          <li key={`${session.id}-p-${pIdx}`} className="flex items-start gap-2">
                            <span className="text-[#2E6B48] dark:text-[#9EC5AB] font-medium shrink-0">
                              {pIdx + 1}.
                            </span>
                            <span>{promptItem}</span>
                          </li>
                        )
                      )}
                    </ul>
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
                    Calm &amp; Grounding
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteSession)}
        title="Delete Event Mode Session?"
        message={
          pendingDeleteSession
            ? `Are you sure you want to delete "${pendingDeleteSession.eventName}"? Check-in notifications for this session will be removed.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pendingDeleteSession) return;
          const id = pendingDeleteSession.id;
          setPendingDeleteSession(null);
          await onDeleteSession(id);
        }}
        onCancel={() => setPendingDeleteSession(null)}
      />
    </div>
  );
};
