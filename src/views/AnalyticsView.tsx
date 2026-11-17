import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, FileText, Lightbulb, Wind } from 'lucide-react';
import type {
  CreativeIdeaCard,
  EventCalmSession,
  MotivationalQuote,
  PersonalNote,
  TaskCategory,
  TaskReminderItem,
} from '../types/sanctuary';

interface AnalyticsViewProps {
  tasks: TaskReminderItem[];
  notes: PersonalNote[];
  eventSessions: EventCalmSession[];
  calmMinutesByDate: Record<string, number>;
  quotes: MotivationalQuote[];
  ideas: CreativeIdeaCard[];
}

type TimeRangeDays = 7 | 14 | 30;
type MetricFocus = 'all' | 'productivity' | 'wellbeing';

interface DailyPoint {
  date: string;
  label: string;
  tasksCompleted: number;
  notesWritten: number;
  calmMinutes: number;
}

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
  label?: string;
}

const SanctuaryTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[#13161C] border border-white/[0.12] px-3.5 py-2.5 shadow-lg">
      <p className="text-xs font-medium text-[#F1F3F6] mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 text-xs">
            <span className="text-[#98A2B3]">{entry.name}</span>
            <span className="font-mono-tabular font-medium" style={{ color: entry.color }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CATEGORIES: TaskCategory[] = ['Personal', 'Work', 'Health', 'Learning', 'Home'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  notes,
  eventSessions,
  calmMinutesByDate,
  quotes,
  ideas,
}) => {
  const [rangeDays, setRangeDays] = useState<TimeRangeDays>(7);
  const [metricFocus, setMetricFocus] = useState<MetricFocus>('all');

  const dailySeries = useMemo<DailyPoint[]>(() => {
    const today = new Date();
    const days: DailyPoint[] = [];

    for (let i = rangeDays - 1; i >= 0; i--) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = getDateKey(dt);
      const label = dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const tasksCompleted = tasks.filter((t) => {
        if (!t.completed) return false;
        const doneDate = (t.completedAt || t.dueDate || t.createdAt).slice(0, 10);
        return doneDate === key;
      }).length;

      const notesWritten = notes.filter(
        (n) => n.createdAt.slice(0, 10) === key || n.updatedAt.slice(0, 10) === key
      ).length;

      // Combine real logged calm breathing minutes + scheduled active event calm sessions on that date
      const loggedBreathingMins = calmMinutesByDate[key] || 0;
      const sessionWindowMins = eventSessions
        .filter((s) => s.date === key && s.active)
        .reduce((acc, s) => {
          const dur = Math.max(0, parseHHMM(s.endTime) - parseHHMM(s.startTime));
          return acc + dur;
        }, 0);

      days.push({
        date: key,
        label,
        tasksCompleted,
        notesWritten,
        calmMinutes: loggedBreathingMins + sessionWindowMins,
      });
    }

    return days;
  }, [tasks, notes, eventSessions, calmMinutesByDate, rangeDays]);

  const totals = useMemo(() => {
    const tasksDoneInRange = dailySeries.reduce((sum, d) => sum + d.tasksCompleted, 0);
    const notesInRange = dailySeries.reduce((sum, d) => sum + d.notesWritten, 0);
    const calmInRange = dailySeries.reduce((sum, d) => sum + d.calmMinutes, 0);

    const totalTasksDone = tasks.filter((t) => t.completed).length;
    const completionRate =
      tasks.length > 0 ? Math.round((totalTasksDone / tasks.length) * 100) : 0;

    const checklistDone = notes.reduce(
      (sum, n) => sum + n.checklist.filter((c) => c.done).length,
      0
    );

    const bestCalmDay = [...dailySeries].sort((a, b) => b.calmMinutes - a.calmMinutes)[0];
    const bestFocusDay = [...dailySeries].sort(
      (a, b) => b.tasksCompleted + b.notesWritten - (a.tasksCompleted + a.notesWritten)
    )[0];

    return {
      tasksDoneInRange,
      notesInRange,
      calmInRange,
      totalTasksDone,
      completionRate,
      checklistDone,
      bestCalmDay,
      bestFocusDay,
    };
  }, [dailySeries, tasks, notes]);

  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const inCat = tasks.filter((t) => t.category === cat);
      return {
        category: cat,
        Completed: inCat.filter((t) => t.completed).length,
        Open: inCat.filter((t) => !t.completed).length,
      };
    });
  }, [tasks]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#9EC5AB]">Analytics · Local Activity Trends</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Productivity & Wellbeing
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1">
            Derived strictly from your local tasks, notes, and Event Calm Mode sessions.
          </p>
        </div>

        {/* Time Range Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#171A21] border border-white/[0.06] self-start sm:self-auto">
          {([7, 14, 30] as TimeRangeDays[]).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                rangeDays === days
                  ? 'bg-[#9EC5AB] text-[#0F1115] font-semibold'
                  : 'text-[#98A2B3] hover:text-[#F1F3F6]'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </header>

      {/* Top 4 KPI Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Tasks Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#9EC5AB]" />
          </div>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#F1F3F6] mt-2">
            {totals.tasksDoneInRange}
          </p>
          <p className="text-xs text-[#98A2B3] mt-1 tabular-nums">
            {totals.completionRate}% overall completion
          </p>
        </div>

        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Notes Activity</span>
            <FileText className="w-4 h-4 text-[#9BC4E2]" />
          </div>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#F1F3F6] mt-2">
            {totals.notesInRange}
          </p>
          <p className="text-xs text-[#98A2B3] mt-1 tabular-nums">
            {totals.checklistDone} checklist steps done
          </p>
        </div>

        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Event Calm Mode</span>
            <Wind className="w-4 h-4 text-[#BEB4DC]" />
          </div>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#F1F3F6] mt-2">
            {totals.calmInRange}m
          </p>
          <p className="text-xs text-[#98A2B3] mt-1 tabular-nums">
            {eventSessions.length} sessions configured
          </p>
        </div>

        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Ideas & Grounding</span>
            <Lightbulb className="w-4 h-4 text-[#F2B8A2]" />
          </div>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#F1F3F6] mt-2">
            {ideas.length + quotes.length}
          </p>
          <p className="text-xs text-[#98A2B3] mt-1 tabular-nums">
            {ideas.length} ideas · {quotes.length} quotes
          </p>
        </div>
      </section>

      {/* Primary Daily Trend Area Chart */}
      <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#F1F3F6]">
              Daily Activity & Calm Rhythm
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Compare tasks finished, notes written, and minutes spent in Event Calm Mode
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#13161C] border border-white/[0.06] self-start sm:self-auto">
            {(
              [
                { id: 'all', label: 'All Metrics' },
                { id: 'productivity', label: 'Productivity' },
                { id: 'wellbeing', label: 'Calm Time' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMetricFocus(opt.id)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  metricFocus === opt.id
                    ? 'bg-[#1D212A] text-[#F1F3F6]'
                    : 'text-[#98A2B3] hover:text-[#F1F3F6]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailySeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTasks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9EC5AB" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#9EC5AB" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradNotes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9BC4E2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#9BC4E2" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradCalm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#BEB4DC" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#BEB4DC" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#98A2B3"
                tick={{ fill: '#98A2B3', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#98A2B3"
                tick={{ fill: '#98A2B3', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<SanctuaryTooltip />} />

              {(metricFocus === 'all' || metricFocus === 'productivity') && (
                <Area
                  type="monotone"
                  dataKey="tasksCompleted"
                  name="Tasks Completed"
                  stroke="#9EC5AB"
                  strokeWidth={2}
                  fill="url(#gradTasks)"
                />
              )}

              {(metricFocus === 'all' || metricFocus === 'productivity') && (
                <Area
                  type="monotone"
                  dataKey="notesWritten"
                  name="Notes Written"
                  stroke="#9BC4E2"
                  strokeWidth={2}
                  fill="url(#gradNotes)"
                />
              )}

              {(metricFocus === 'all' || metricFocus === 'wellbeing') && (
                <Area
                  type="monotone"
                  dataKey="calmMinutes"
                  name="Event Calm (min)"
                  stroke="#BEB4DC"
                  strokeWidth={2}
                  fill="url(#gradCalm)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Clean Unboxed Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-[#98A2B3] pt-1">
          {(metricFocus === 'all' || metricFocus === 'productivity') && (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9EC5AB]" />
                Tasks Completed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9BC4E2]" />
                Notes Written
              </span>
            </>
          )}
          {(metricFocus === 'all' || metricFocus === 'wellbeing') && (
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#BEB4DC]" />
              Event Calm Mode (min)
            </span>
          )}
        </div>
      </section>

      {/* Secondary 2-Column Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Balance Bar Chart */}
        <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#F1F3F6]">Tasks by Life Area</h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Completed vs. open reminders across your categories
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryBreakdown}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="category"
                  stroke="#98A2B3"
                  tick={{ fill: '#98A2B3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#98A2B3"
                  tick={{ fill: '#98A2B3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<SanctuaryTooltip />} />
                <Bar dataKey="Completed" stackId="a" fill="#9EC5AB" radius={[0, 0, 6, 6]} />
                <Bar dataKey="Open" stackId="a" fill="#9BC4E2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Event Calm Mode Daily Minutes Bar Chart */}
        <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F1F3F6]">
              Event Calm & Breathing Time
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Minutes spent in grounding sessions and active Event Mode windows
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#98A2B3"
                  tick={{ fill: '#98A2B3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#98A2B3"
                  tick={{ fill: '#98A2B3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<SanctuaryTooltip />} />
                <Bar
                  dataKey="calmMinutes"
                  name="Calm Minutes"
                  fill="#BEB4DC"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-xs text-[#98A2B3] flex flex-wrap items-center justify-between gap-2">
            <span>
              Most focused day:{' '}
              <span className="text-[#F1F3F6] font-medium">
                {totals.bestFocusDay &&
                totals.bestFocusDay.tasksCompleted + totals.bestFocusDay.notesWritten > 0
                  ? `${totals.bestFocusDay.label} (${
                      totals.bestFocusDay.tasksCompleted + totals.bestFocusDay.notesWritten
                    } items)`
                  : 'Complete a task or write a note today'}
              </span>
            </span>
            <span>
              Calmest day:{' '}
              <span className="text-[#BEB4DC] font-medium">
                {totals.bestCalmDay && totals.bestCalmDay.calmMinutes > 0
                  ? `${totals.bestCalmDay.label} (${totals.bestCalmDay.calmMinutes}m)`
                  : 'Try Calm Breathing anytime'}
              </span>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
