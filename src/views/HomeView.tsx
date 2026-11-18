import React from 'react';
import {
  ArrowRight,
  Cake,
  CheckCircle2,
  Compass,
  Navigation,
  Quote,
  RefreshCw,
  Sparkles,
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
  userName?: string;
  quotes: MotivationalQuote[];
  featuredQuote?: MotivationalQuote | null;
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
  userName,
  quotes,
  featuredQuote: featuredQuoteProp,
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
    featuredQuoteProp || quotes.find((q) => q.pinnedToHome) || quotes[0] || null;

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
      {/* Sanctuary Greeting Hero (Sage & Misty Sky Horizon Wash) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#EAF5EE] via-[#F2F7FA] to-[#F7F3FB] dark:from-[#172521] dark:via-[#171E2A] dark:to-[#1F1A2B] border border-[#9EC5AB]/40 dark:border-[#9EC5AB]/25 shadow-sm">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/sanctuary_calm_horizon_1794911112791.jpg"
            alt="Quiet misty twilight hills"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-20 dark:opacity-28"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F4FAF6]/95 via-[#F4FAF6]/78 to-[#EEF5FA]/45 dark:from-[#151D22]/95 dark:via-[#161E27]/78 dark:to-[#181A26]/45" />
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB] tracking-wide mb-2">
              {formattedDate} · Personal Sanctuary
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-medium text-[#111827] dark:text-[#F1F3F6] leading-tight text-balance">
              {userName?.trim()
                ? `${greeting}, ${userName.trim().split(/\s+/)[0]}`
                : greeting}
            </h1>
            <p className="text-sm sm:text-base text-[#334155] dark:text-[#D0D5DD] mt-2.5 leading-relaxed max-w-xl">
              {subMessage}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] active:scale-[0.99] text-[#0F1115] font-semibold text-sm flex items-center justify-center gap-2.5 transition-all whitespace-nowrap shadow-sm"
            >
              <Compass className="w-4 h-4" />
              Explore Your Day
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Active Event Calm Mode Banner */}
      {activeEventSession && (
        <section className="rounded-3xl bg-gradient-to-br from-[#EAF6EE] to-[#F6FBF8] dark:from-[#162721] dark:to-[#171C24] border border-[#9EC5AB]/45 dark:border-[#9EC5AB]/30 p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB]">
              <Wind className="w-4 h-4" />
              <span>
                Event Calm Mode Active · {formatTime12h(activeEventSession.startTime)} –{' '}
                {formatTime12h(activeEventSession.endTime)}
              </span>
            </div>
            <h2 className="font-display text-xl text-[#111827] dark:text-[#F1F3F6] font-medium">
              {activeEventSession.eventName}
            </h2>
            <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
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
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-[#1D232E] hover:bg-white dark:hover:bg-[#232A37] border border-[#9BC4E2]/45 text-sm font-medium text-[#1E5F8A] dark:text-[#9BC4E2] flex items-center gap-2 transition-colors whitespace-nowrap"
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
        {/* Left Column: Daily Quote (Lavender) + Today's Top Reminders (Sage/Mint) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Featured Daily Quote — Lavender Pastel Surface */}
          <section className="rounded-3xl bg-gradient-to-br from-[#F3EFFC] via-[#F9F7FD] to-[#FFFFFF] dark:from-[#211B30] dark:via-[#191926] dark:to-[#171B24] border border-[#BEB4DC]/45 dark:border-[#BEB4DC]/25 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#BEB4DC]/30 dark:bg-[#BEB4DC]/20 flex items-center justify-center shrink-0">
                  <Quote className="w-4 h-4 text-[#5B4D8A] dark:text-[#C7B8EA]" />
                </div>
                <div className="text-xs font-medium text-[#5B4D8A] dark:text-[#C7B8EA]">
                  Daily Grounding Quote
                  {featuredQuote ? ` · ${featuredQuote.mood}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onShuffleQuote}
                  aria-label="Shuffle quote"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] border border-[#BEB4DC]/35 text-xs font-medium text-[#473B73] dark:text-[#D5CBEF] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#5B4D8A] dark:text-[#C7B8EA]" />
                  Shuffle
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('quotes')}
                  className="min-h-[44px] px-3 rounded-xl hover:bg-[#BEB4DC]/20 text-xs font-medium text-[#5B4D8A] dark:text-[#C7B8EA] transition-colors whitespace-nowrap"
                >
                  Collection
                </button>
              </div>
            </div>

            {featuredQuote ? (
              <div>
                <blockquote className="font-display text-xl sm:text-2xl text-[#111827] dark:text-[#F1F3F6] leading-relaxed text-balance">
                  “{featuredQuote.text}”
                </blockquote>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-4">
                  — {featuredQuote.author || 'Personal Sanctuary'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
                Add your favorite calming quotes to keep them right here on your home screen.
              </p>
            )}
          </section>

          {/* Today's Top Reminders — Soft Sage Mint Pastel Surface */}
          <section className="rounded-3xl bg-gradient-to-br from-[#ECF7F0] via-[#F7FCF9] to-[#FFFFFF] dark:from-[#162520] dark:via-[#171E24] dark:to-[#171B24] border border-[#9EC5AB]/45 dark:border-[#9EC5AB]/25 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#9EC5AB]/30 dark:bg-[#9EC5AB]/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    Today’s Focus & Reminders
                  </h2>
                  <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                    {pendingTasks.length === 0
                      ? 'Everything scheduled is clear'
                      : `${pendingTasks.length} gentle priorities waiting`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="min-h-[44px] px-3 rounded-xl bg-white/75 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] border border-[#9EC5AB]/35 text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB] transition-colors whitespace-nowrap"
              >
                Open Tasks
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
                  Your task list is serene. Add a reminder or enjoy the quiet space.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#9EC5AB]/25 dark:divide-white/[0.06]">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="py-3.5 first:pt-1 last:pb-1 flex items-start gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      aria-label={`Mark ${task.title} complete`}
                      className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center text-[#2E6B48] dark:text-[#9EC5AB] hover:opacity-80 transition-opacity shrink-0"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1 pt-2">
                      <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6] truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
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

        {/* Right Column: Upcoming Birthdays (Peach/Rose) + Event Calm Companion (Sky) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Birthdays — Warm Sunset Peach & Blossom Rose */}
          <section className="rounded-3xl bg-gradient-to-br from-[#FDF1EC] via-[#FEF8F6] to-[#FFFFFF] dark:from-[#271B1B] dark:via-[#1E1A22] dark:to-[#171B24] border border-[#F2B8A2]/45 dark:border-[#F2B8A2]/25 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F2B8A2]/35 dark:bg-[#F2B8A2]/20 flex items-center justify-center shrink-0">
                  <Cake className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2]" />
                </div>
                <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  Upcoming Birthdays
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('birthdays')}
                className="min-h-[44px] px-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] border border-[#F2B8A2]/40 text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2] transition-colors whitespace-nowrap"
              >
                View All
              </button>
            </div>

            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] py-3">
                No birthdays tracked yet. Add loved ones and pre-write wishes ahead of time.
              </p>
            ) : (
              <div className="divide-y divide-[#F2B8A2]/25 dark:divide-white/[0.06]">
                {upcomingBirthdays.map(({ entry, info }) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onNavigate('birthdays')}
                    className="w-full text-left py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 hover:opacity-90 transition-opacity"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6] truncate">
                        {entry.name}
                      </p>
                      <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                        {entry.relationship}
                        {info.turningAge ? ` · Turning ${info.turningAge}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                        info.daysUntil <= 3
                          ? 'text-[#A6482D] dark:text-[#F2B8A2]'
                          : 'text-[#5B6472] dark:text-[#98A2B3]'
                      }`}
                    >
                      {info.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Event Calm Mode Sanctuary Card — Misty Sky Pastel */}
          <section className="rounded-3xl bg-gradient-to-br from-[#ECF5FC] via-[#F7FBFF] to-[#FFFFFF] dark:from-[#16212E] dark:via-[#171D26] dark:to-[#171B24] border border-[#9BC4E2]/45 dark:border-[#9BC4E2]/25 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#9BC4E2]/35 dark:bg-[#9BC4E2]/20 flex items-center justify-center shrink-0">
                  <Wind className="w-4 h-4 text-[#1E5F8A] dark:text-[#9BC4E2]" />
                </div>
                <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  Event Calm Companion
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('event-calm')}
                className="min-h-[44px] px-3 rounded-xl bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] border border-[#9BC4E2]/40 text-xs font-medium text-[#1E5F8A] dark:text-[#9BC4E2] transition-colors whitespace-nowrap"
              >
                Configure
              </button>
            </div>

            <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
              Heading into a crowded gathering? Set an event time window, gentle check-in
              intervals, grounding reminders, and one-tap venue directions.
            </p>

            {nextScheduledEvent && (
              <div className="mt-4 pt-4 border-t border-[#9BC4E2]/25 dark:border-white/[0.06] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6] truncate">
                    {nextScheduledEvent.eventName}
                  </p>
                  <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5 truncate">
                    {formatTime12h(nextScheduledEvent.startTime)} –{' '}
                    {formatTime12h(nextScheduledEvent.endTime)}
                    {nextScheduledEvent.venue ? ` · ${nextScheduledEvent.venue}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenBreathing(nextScheduledEvent)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-xs font-semibold text-[#0F1115] whitespace-nowrap shrink-0 transition-colors"
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
