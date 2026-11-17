import React from 'react';
import {
  ArrowRight,
  Cake,
  CheckCircle2,
  Compass,
  Navigation,
  RefreshCw,
  Wind,
} from 'lucide-react';
import type {
  AppRoute,
  BirthdayEntry,
  EventCalmSession,
  MotivationalQuote,
  TaskReminderItem,
} from '../types/sanctuary';
import {
  buildGoogleMapsDirectionsUrl,
  formatFullDate,
  formatTime12h,
  getDaysUntilBirthday,
  getGreetingByHour,
} from '../lib/dateUtils';

interface HomeViewProps {
  quotes: MotivationalQuote[];
  tasks: TaskReminderItem[];
  birthdays: BirthdayEntry[];
  eventSessions: EventCalmSession[];
  activeEventSession: EventCalmSession | null;
  onNavigate: (route: AppRoute) => void;
  onShuffleQuote: () => void;
  onToggleTask: (id: string) => void;
  onOpenBreathing: (session: EventCalmSession) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  quotes,
  tasks,
  birthdays,
  eventSessions,
  activeEventSession,
  onNavigate,
  onShuffleQuote,
  onToggleTask,
  onOpenBreathing,
}) => {
  const { greeting, subMessage } = getGreetingByHour();
  const formattedDate = formatFullDate();

  const featuredQuote =
    quotes.find((q) => q.pinnedToHome) || quotes[0] || null;

  const pendingTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 4);

  const upcomingBirthdays = [...birthdays]
    .map((b) => ({ entry: b, info: getDaysUntilBirthday(b.birthDate) }))
    .sort((a, b) => a.info.daysUntil - b.info.daysUntil)
    .slice(0, 3);

  const nextScheduledEvent =
    activeEventSession ||
    eventSessions.find((s) => s.active) ||
    eventSessions[0] ||
    null;

  return (
    <div className="space-y-6">
      {/* Sanctuary Greeting Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-[#171A21] border border-white/[0.07]">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/sanctuary_calm_horizon_1794911112791.jpg"
            alt="Quiet misty twilight hills"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#171A21] via-[#171A21]/80 to-[#171A21]/45" />
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs text-[#9EC5AB] tracking-wide mb-2">
              {formattedDate} · Local Sanctuary
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-medium text-[#F1F3F6] leading-tight text-balance">
              {greeting}
            </h1>
            <p className="text-sm sm:text-base text-[#D0D5DD] mt-2.5 leading-relaxed max-w-xl">
              {subMessage}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] active:scale-[0.99] text-[#0F1115] font-semibold text-sm flex items-center justify-center gap-2.5 transition-all whitespace-nowrap"
            >
              <Compass className="w-4 h-4" />
              Explore Your Day
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Active Event Calm Mode Banner (Live or Ready) */}
      {activeEventSession && (
        <section className="rounded-3xl bg-[#171A21] border border-[#9EC5AB]/30 p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#9EC5AB]">
              <Wind className="w-4 h-4" />
              <span>
                Event Calm Mode Active · {formatTime12h(activeEventSession.startTime)} –{' '}
                {formatTime12h(activeEventSession.endTime)}
              </span>
            </div>
            <h2 className="font-display text-xl text-[#F1F3F6] font-medium">
              {activeEventSession.eventName}
            </h2>
            <p className="text-sm text-[#98A2B3]">
              Gentle check-ins{' '}
              {activeEventSession.isMidpointOnly
                ? 'at the event midpoint'
                : `every ${activeEventSession.intervalMinutes} minutes`}
              {activeEventSession.venue ? ` · ${activeEventSession.venue}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {activeEventSession.venue.trim() && (
              <a
                href={buildGoogleMapsDirectionsUrl(activeEventSession.venue)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-[#9BC4E2] flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Navigation className="w-4 h-4" />
                Navigate to Venue
              </a>
            )}
            <button
              type="button"
              onClick={() => onOpenBreathing(activeEventSession)}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Wind className="w-4 h-4" />
              Calm Breathing
            </button>
          </div>
        </section>
      )}

      {/* Main 2-Column Editorial Grid on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Daily Quote + Today's Top Reminders */}
        <div className="lg:col-span-7 space-y-6">
          {/* Featured Daily Quote */}
          <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="text-xs text-[#BEB4DC]">
                Daily Grounding Quote
                {featuredQuote ? ` · ${featuredQuote.mood}` : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onShuffleQuote}
                  aria-label="Shuffle quote"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#D0D5DD] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#BEB4DC]" />
                  Shuffle
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('quotes')}
                  className="min-h-[44px] px-3 rounded-xl hover:bg-white/[0.05] text-xs font-medium text-[#98A2B3] hover:text-[#F1F3F6] transition-colors whitespace-nowrap"
                >
                  Collection
                </button>
              </div>
            </div>

            {featuredQuote ? (
              <div>
                <blockquote className="font-display text-xl sm:text-2xl text-[#F1F3F6] leading-relaxed text-balance">
                  “{featuredQuote.text}”
                </blockquote>
                <p className="text-xs text-[#98A2B3] mt-4">
                  — {featuredQuote.author || 'Personal Sanctuary'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#98A2B3]">
                Add your favorite calming quotes to keep them right here on your home screen.
              </p>
            )}
          </section>

          {/* Today's Top Reminders */}
          <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#F1F3F6]">Today’s Focus & Reminders</h2>
                <p className="text-xs text-[#98A2B3] mt-0.5">
                  {pendingTasks.length === 0
                    ? 'Everything scheduled is clear'
                    : `${pendingTasks.length} gentle priorities waiting`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="min-h-[44px] px-3 rounded-xl hover:bg-white/[0.05] text-xs font-medium text-[#9BC4E2] transition-colors whitespace-nowrap"
              >
                Open Tasks
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[#98A2B3]">
                  Your task list is serene. Add a reminder or enjoy the quiet space.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="py-3.5 first:pt-1 last:pb-1 flex items-start gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      aria-label={`Mark ${task.title} complete`}
                      className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-[#98A2B3] hover:text-[#9EC5AB] transition-colors shrink-0"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1 pt-2">
                      <p className="text-sm font-medium text-[#F1F3F6] truncate">{task.title}</p>
                      <p className="text-xs text-[#98A2B3] mt-0.5">
                        {task.priority} · {task.category}
                        {task.dueTime ? ` · ${formatTime12h(task.dueTime)}` : ''}
                        {task.linkedAlarmId ? ' · Alarm linked' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Upcoming Birthdays + Event Calm Companion Quick Card */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Birthdays */}
          <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-[#F2B8A2]" />
                <h2 className="text-base font-semibold text-[#F1F3F6]">Upcoming Birthdays</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('birthdays')}
                className="min-h-[44px] px-3 rounded-xl hover:bg-white/[0.05] text-xs font-medium text-[#F2B8A2] transition-colors whitespace-nowrap"
              >
                View All
              </button>
            </div>

            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-[#98A2B3] py-3">
                No birthdays tracked yet. Add loved ones and pre-write wishes ahead of time.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {upcomingBirthdays.map(({ entry, info }) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onNavigate('birthdays')}
                    className="w-full text-left py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 hover:opacity-90 transition-opacity"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F1F3F6] truncate">{entry.name}</p>
                      <p className="text-xs text-[#98A2B3] mt-0.5">
                        {entry.relationship}
                        {info.turningAge ? ` · Turning ${info.turningAge}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium tabular-nums whitespace-nowrap shrink-0 ${
                        info.daysUntil <= 3 ? 'text-[#F2B8A2]' : 'text-[#98A2B3]'
                      }`}
                    >
                      {info.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Event Calm Mode Sanctuary Card */}
          <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-[#9EC5AB]" />
                <h2 className="text-base font-semibold text-[#F1F3F6]">Event Calm Companion</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('event-calm')}
                className="min-h-[44px] px-3 rounded-xl hover:bg-white/[0.05] text-xs font-medium text-[#9EC5AB] transition-colors whitespace-nowrap"
              >
                Configure
              </button>
            </div>

            <p className="text-sm text-[#98A2B3] leading-relaxed">
              Heading into a crowded gathering? Set an event time window, gentle check-in
              intervals, grounding reminders, and one-tap venue directions.
            </p>

            {nextScheduledEvent && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#F1F3F6] truncate">
                    {nextScheduledEvent.eventName}
                  </p>
                  <p className="text-xs text-[#98A2B3] mt-0.5 truncate">
                    {formatTime12h(nextScheduledEvent.startTime)} –{' '}
                    {formatTime12h(nextScheduledEvent.endTime)}
                    {nextScheduledEvent.venue ? ` · ${nextScheduledEvent.venue}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenBreathing(nextScheduledEvent)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1D212A] hover:bg-white/[0.08] text-xs font-medium text-[#9EC5AB] whitespace-nowrap shrink-0 transition-colors"
                >
                  Breathe
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
