import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  HandHeart,
  Navigation,
  Play,
  Sparkles,
  Volume2,
  Wind,
  X,
} from 'lucide-react';
import type { CustomAudioTone, EventCalmSession } from '../types/sanctuary';
import { buildGoogleMapsDirectionsUrl } from '../lib/dateUtils';
import { ALARM_MAX_RING_MS, MAX_AUTO_SNOOZES, playNotificationSound } from '../lib/sound';

interface EventCheckInOverlayProps {
  session: EventCalmSession;
  promptMessage: string;
  customAudioTones: CustomAudioTone[];
  notificationSoundId: string;
  muteInitialChime?: boolean;
  isRingingAlarm?: boolean;
  ringingStartedAtMs?: number;
  autoSnoozeCount?: number;
  snoozeMinutes?: number;
  onSnooze?: (minutes: number) => void;
  onClose: () => void;
}

type CalmActivityTab = 'breathing' | 'grounding' | 'prompts';
type BreathPatternId = 'calm-435' | 'box-4444';

const BREATH_PATTERNS: Record<
  BreathPatternId,
  { name: string; subtitle: string; phases: { label: string; seconds: number }[] }
> = {
  'calm-435': {
    name: '4-3-5 Calm',
    subtitle: 'Longer exhale slows heart rate & social tension',
    phases: [
      { label: 'Inhale slowly', seconds: 4 },
      { label: 'Hold gently', seconds: 3 },
      { label: 'Exhale completely', seconds: 5 },
    ],
  },
  'box-4444': {
    name: '4-4-4-4 Box',
    subtitle: 'Steady rhythm for clarity in busy rooms',
    phases: [
      { label: 'Inhale gently', seconds: 4 },
      { label: 'Hold steady', seconds: 4 },
      { label: 'Exhale slowly', seconds: 4 },
      { label: 'Quiet pause', seconds: 4 },
    ],
  },
};

const SENSORY_STEPS = [
  { id: 'see-5', count: '5', title: 'Notice 5 colors or soft lights around you' },
  { id: 'touch-4', count: '4', title: 'Feel 4 physical anchors (feet on floor, chair, fabric, cool air)' },
  { id: 'hear-3', count: '3', title: 'Pick out 3 distinct sounds without judging them' },
  { id: 'smell-2', count: '2', title: 'Take 2 slow breaths and notice any calm scent or fresh air' },
  { id: 'steady-1', count: '1', title: 'Remind yourself of 1 kind truth: you are safe to move at your own pace' },
];

export const EventCheckInOverlay: React.FC<EventCheckInOverlayProps> = ({
  session,
  promptMessage,
  customAudioTones,
  notificationSoundId,
  muteInitialChime,
  isRingingAlarm,
  ringingStartedAtMs,
  autoSnoozeCount = 0,
  snoozeMinutes = 5,
  onSnooze,
  onClose,
}) => {
  const [activityTab, setActivityTab] = useState<CalmActivityTab>('breathing');
  const [breathPattern, setBreathPattern] = useState<BreathPatternId>('calm-435');
  const [breathTimer, setBreathTimer] = useState<{ phaseIndex: number; secondsLeft: number }>({
    phaseIndex: 0,
    secondsLeft: BREATH_PATTERNS['calm-435'].phases[0].seconds,
  });

  const maxSeconds = Math.round(ALARM_MAX_RING_MS / 1000);
  const [ringSecondsLeft, setRingSecondsLeft] = useState<number>(maxSeconds);

  const [checkedSenses, setCheckedSenses] = useState<Record<string, boolean>>({});
  const allPrompts = Array.from(
    new Set(
      [promptMessage, ...session.selectedPrompts, ...session.customPrompts]
        .map((p) => p.trim())
        .filter(Boolean)
    )
  );
  const [promptCursor, setPromptCursor] = useState(0);
  const [quietThought, setQuietThought] = useState('');

  useEffect(() => {
    if (!muteInitialChime && !isRingingAlarm) {
      playNotificationSound(customAudioTones, notificationSoundId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRingingAlarm) return;
    const start = ringingStartedAtMs ?? Date.now();
    const update = () => {
      const elapsedSec = Math.floor((Date.now() - start) / 1000);
      setRingSecondsLeft(Math.max(0, maxSeconds - elapsedSec));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isRingingAlarm, ringingStartedAtMs, maxSeconds]);

  useEffect(() => {
    const phases = BREATH_PATTERNS[breathPattern].phases;
    setBreathTimer({ phaseIndex: 0, secondsLeft: phases[0].seconds });

    const timer = window.setInterval(() => {
      setBreathTimer((prev) => {
        if (prev.secondsLeft > 1) {
          return { phaseIndex: prev.phaseIndex, secondsLeft: prev.secondsLeft - 1 };
        }
        const nextIdx = (prev.phaseIndex + 1) % phases.length;
        return { phaseIndex: nextIdx, secondsLeft: phases[nextIdx].seconds };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [breathPattern]);

  const activePattern = BREATH_PATTERNS[breathPattern];
  const currentPhase = activePattern.phases[breathTimer.phaseIndex % activePattern.phases.length];
  const phaseSecondsLeft = breathTimer.secondsLeft;
  const completedSenses = SENSORY_STEPS.filter((s) => checkedSenses[s.id]).length;
  const activePromptCard = allPrompts[promptCursor % Math.max(1, allPrompts.length)] || promptMessage;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-[#0F1115]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Event Calm Companion"
    >
      <div className="max-w-lg w-full bg-white dark:bg-[#171A21] border border-slate-900/[0.10] dark:border-white/[0.08] rounded-3xl p-6 sm:p-8 relative text-center my-auto shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close grounding screen"
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.04] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 text-xs text-[#2E6B48] dark:text-[#9EC5AB] mb-3 pr-8 pl-8">
          <Wind className="w-4 h-4 shrink-0" />
          <span className="truncate">Event Calm Mode · {session.eventName}</span>
        </div>

        {isRingingAlarm && (
          <div className="mb-4 rounded-2xl bg-[#FCEEE9] dark:bg-[#291C19] border border-[#F2B8A2]/45 px-4 py-3 text-left flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#A6482D] dark:text-[#F2B8A2] inline-flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 animate-pulse" />
                <Play className="w-3 h-3 fill-current" />
                <span>Check-In Alarm Ringing</span>
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              </span>
              <span className="text-[11px] font-mono-tabular text-[#913B22] dark:text-[#F5C1AD] tabular-nums">
                {autoSnoozeCount >= MAX_AUTO_SNOOZES
                  ? `Final ring · 0:${String(ringSecondsLeft).padStart(2, '0')}`
                  : `Auto-snooze ${autoSnoozeCount + 1}/${MAX_AUTO_SNOOZES} · 0:${String(ringSecondsLeft).padStart(2, '0')}`}
              </span>
            </div>
            {onSnooze && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSnooze(snoozeMinutes)}
                  className="flex-1 min-h-[38px] px-3 rounded-xl bg-white/85 dark:bg-[#171A21] border border-slate-900/[0.1] dark:border-white/[0.1] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] inline-flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-[#5B4D8A] dark:text-[#BEB4DC]" />
                  Snooze {snoozeMinutes}m
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#9EC5AB] text-[#0F1115] text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Stop Alarm
                </button>
              </div>
            )}
          </div>
        )}

        {/* Multi-Activity Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.06] mb-5">
          <button
            type="button"
            onClick={() => setActivityTab('breathing')}
            className={`min-h-[40px] px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activityTab === 'breathing'
                ? 'bg-white dark:bg-[#131722] text-[#2E6B48] dark:text-[#9EC5AB] font-semibold shadow-xs'
                : 'text-[#5B6472] dark:text-[#98A2B3]'
            }`}
          >
            <Wind className="w-3.5 h-3.5 shrink-0" />
            <span>Breathing</span>
          </button>
          <button
            type="button"
            onClick={() => setActivityTab('grounding')}
            className={`min-h-[40px] px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activityTab === 'grounding'
                ? 'bg-white dark:bg-[#131722] text-[#255F8A] dark:text-[#9BC4E2] font-semibold shadow-xs'
                : 'text-[#5B6472] dark:text-[#98A2B3]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>5-4-3-2-1</span>
          </button>
          <button
            type="button"
            onClick={() => setActivityTab('prompts')}
            className={`min-h-[40px] px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              activityTab === 'prompts'
                ? 'bg-white dark:bg-[#131722] text-[#5B4D8A] dark:text-[#BEB4DC] font-semibold shadow-xs'
                : 'text-[#5B6472] dark:text-[#98A2B3]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Prompts ({allPrompts.length})</span>
          </button>
        </div>

        {/* Activity 1: Breathing Guide */}
        {activityTab === 'breathing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {(['calm-435', 'box-4444'] as BreathPatternId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => setBreathPattern(pid)}
                  className={`min-h-[34px] px-3 rounded-xl text-[11px] font-medium border transition-colors ${
                    breathPattern === pid
                      ? 'bg-[#9EC5AB]/20 border-[#9EC5AB]/45 text-[#1F5638] dark:text-[#A9DFBE]'
                      : 'bg-transparent border-slate-900/[0.08] dark:border-white/[0.08] text-[#5B6472] dark:text-[#98A2B3]'
                  }`}
                >
                  {BREATH_PATTERNS[pid].name}
                </button>
              ))}
            </div>

            <div className="relative flex items-center justify-center my-4 h-44">
              <div className="w-40 h-40 rounded-full bg-[#9EC5AB]/10 border border-[#9EC5AB]/30 flex items-center justify-center animate-breathe">
                <div className="w-28 h-28 rounded-full bg-[#9EC5AB]/15 border border-[#9EC5AB]/40 flex flex-col items-center justify-center px-3">
                  <span className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6]">
                    {currentPhase.label}
                  </span>
                  <span className="text-base font-mono-tabular font-semibold text-[#2E6B48] dark:text-[#9EC5AB] mt-0.5 tabular-nums">
                    {phaseSecondsLeft}s
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">{activePattern.subtitle}</p>

            <blockquote className="font-display text-lg sm:text-xl text-[#111827] dark:text-[#F1F3F6] leading-relaxed text-balance px-2">
              “{promptMessage}”
            </blockquote>
          </div>
        )}

        {/* Activity 2: 5-4-3-2-1 Sensory Grounding */}
        {activityTab === 'grounding' && (
          <div className="text-left space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  5-4-3-2-1 Sensory Reset
                </h2>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                  Tap each anchor slowly to bring your mind back into the room.
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-[#255F8A] dark:text-[#9BC4E2] shrink-0">
                {completedSenses}/{SENSORY_STEPS.length}
              </span>
            </div>

            <div className="space-y-2">
              {SENSORY_STEPS.map((step) => {
                const done = Boolean(checkedSenses[step.id]);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() =>
                      setCheckedSenses((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
                    }
                    className={`w-full min-h-[48px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-colors ${
                      done
                        ? 'bg-[#E6F2FA] dark:bg-[#182430] border-[#9BC4E2]/50 text-[#111827] dark:text-[#F1F3F6]'
                        : 'bg-[#F4F6F8] dark:bg-[#1D212A] border-slate-900/[0.08] dark:border-white/[0.06] text-[#334155] dark:text-[#D0D5DD]'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 ${
                        done
                          ? 'bg-[#9BC4E2] text-[#0F1115]'
                          : 'bg-white dark:bg-[#131722] text-[#255F8A] dark:text-[#9BC4E2]'
                      }`}
                    >
                      {done ? <Check className="w-4 h-4" /> : step.count}
                    </span>
                    <span className="text-xs leading-relaxed">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity 3: Grounding Prompt Deck & Quiet Thought Release */}
        {activityTab === 'prompts' && (
          <div className="space-y-4 text-left">
            <div className="rounded-2xl bg-[#F4F1FA] dark:bg-[#1D1A2B] border border-[#BEB4DC]/40 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-[#5B4D8A] dark:text-[#BEB4DC]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <HandHeart className="w-4 h-4" />
                  Reassurance Card
                </span>
                <span className="font-mono-tabular">
                  {(promptCursor % allPrompts.length) + 1} / {allPrompts.length}
                </span>
              </div>

              <p className="font-display text-lg text-[#111827] dark:text-[#F1F3F6] leading-relaxed">
                “{activePromptCard}”
              </p>

              {allPrompts.length > 1 && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPromptCursor((c) => (c - 1 + allPrompts.length) % allPrompts.length)
                    }
                    aria-label="Previous prompt"
                    className="min-w-[40px] min-h-[38px] rounded-xl bg-white/80 dark:bg-[#131722] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-[#334155] dark:text-[#D0D5DD]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptCursor((c) => (c + 1) % allPrompts.length)}
                    aria-label="Next prompt"
                    className="min-w-[40px] min-h-[38px] px-3 rounded-xl bg-white/80 dark:bg-[#131722] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center gap-1 text-xs font-medium text-[#334155] dark:text-[#D0D5DD]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="event-calm-quiet-thought"
                className="block text-xs font-medium text-[#5B6472] dark:text-[#98A2B3]"
              >
                Quiet Brain Dump (stays private right here, clears when closed)
              </label>
              <textarea
                id="event-calm-quiet-thought"
                rows={3}
                value={quietThought}
                onChange={(e) => setQuietThought(e.target.value)}
                placeholder="Write anything making you anxious right now to let it pass..."
                className="w-full p-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          {session.venue.trim() && (
            <a
              href={buildGoogleMapsDirectionsUrl(session.venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" />
              Navigate to Venue
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold transition-colors whitespace-nowrap"
          >
            I feel grounded
          </button>
        </div>
      </div>
    </div>
  );
};
