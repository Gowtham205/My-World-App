import React, { useState } from 'react';
import {
  AlarmClock,
  AudioLines,
  BarChart3,
  Cake,
  Calendar,
  CheckSquare,
  Download,
  FileText,
  Gamepad2,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  MapPin,
  MessageSquareHeart,
  Mic,
  PhoneCall,
  Quote,
  Shield,
  Wind,
} from 'lucide-react';
import type { AppRoute } from '../types/sanctuary';
import { exportLocalBackupJson } from '../lib/storage';
import { exportToDevicePublicStorage } from '../lib/nativeAudio';

interface ExploreHubViewProps {
  counts: {
    notes: number;
    vault: number;
    quotes: number;
    tasks: number;
    birthdays: number;
    media: number;
    calendar: number;
    alarms: number;
    ideas: number;
    events: number;
    activeSoundscapes: number;
  };
  onNavigate: (route: AppRoute) => void;
}

type PastelTone = 'sage' | 'lavender' | 'sky' | 'peach' | 'rose' | 'honey';

const PASTEL_STYLES: Record<
  PastelTone,
  {
    card: string;
    iconBox: string;
    iconText: string;
  }
> = {
  sage: {
    card: 'bg-gradient-to-br from-[#ECF7F0] via-[#F7FCF9] to-[#FFFFFF] hover:from-[#E2F3E9] hover:to-[#F7FCF9] dark:from-[#16251F] dark:via-[#171E24] dark:to-[#171B24] border-[#9EC5AB]/45 dark:border-[#9EC5AB]/25',
    iconBox: 'bg-[#9EC5AB]/30 dark:bg-[#9EC5AB]/20 border-[#9EC5AB]/45 dark:border-[#9EC5AB]/30',
    iconText: 'text-[#245A3B] dark:text-[#9EC5AB]',
  },
  lavender: {
    card: 'bg-gradient-to-br from-[#F3EFFC] via-[#F9F7FD] to-[#FFFFFF] hover:from-[#EAE3FA] hover:to-[#F9F7FD] dark:from-[#201A2F] dark:via-[#191926] dark:to-[#171B24] border-[#BEB4DC]/45 dark:border-[#BEB4DC]/25',
    iconBox: 'bg-[#BEB4DC]/35 dark:bg-[#BEB4DC]/20 border-[#BEB4DC]/45 dark:border-[#BEB4DC]/30',
    iconText: 'text-[#4E3F80] dark:text-[#C7B8EA]',
  },
  sky: {
    card: 'bg-gradient-to-br from-[#EBF5FC] via-[#F6FBFF] to-[#FFFFFF] hover:from-[#DFEFFA] hover:to-[#F6FBFF] dark:from-[#15212E] dark:via-[#171D26] dark:to-[#171B24] border-[#9BC4E2]/45 dark:border-[#9BC4E2]/25',
    iconBox: 'bg-[#9BC4E2]/35 dark:bg-[#9BC4E2]/20 border-[#9BC4E2]/45 dark:border-[#9BC4E2]/30',
    iconText: 'text-[#1B5780] dark:text-[#9BC4E2]',
  },
  peach: {
    card: 'bg-gradient-to-br from-[#FDF1EC] via-[#FEF8F5] to-[#FFFFFF] hover:from-[#FAE6DD] hover:to-[#FEF8F5] dark:from-[#271C1B] dark:via-[#1E1B22] dark:to-[#171B24] border-[#F2B8A2]/45 dark:border-[#F2B8A2]/25',
    iconBox: 'bg-[#F2B8A2]/35 dark:bg-[#F2B8A2]/20 border-[#F2B8A2]/45 dark:border-[#F2B8A2]/30',
    iconText: 'text-[#9A3F26] dark:text-[#F2B8A2]',
  },
  rose: {
    card: 'bg-gradient-to-br from-[#FCEFF5] via-[#FEF7FA] to-[#FFFFFF] hover:from-[#F8E2ED] hover:to-[#FEF7FA] dark:from-[#261923] dark:via-[#1D1924] dark:to-[#171B24] border-[#EAB8CE]/45 dark:border-[#EAB8CE]/25',
    iconBox: 'bg-[#EAB8CE]/35 dark:bg-[#EAB8CE]/20 border-[#EAB8CE]/45 dark:border-[#EAB8CE]/30',
    iconText: 'text-[#843B5C] dark:text-[#EAB8CE]',
  },
  honey: {
    card: 'bg-gradient-to-br from-[#FCF5E6] via-[#FFFBF2] to-[#FFFFFF] hover:from-[#F9ECD2] hover:to-[#FFFBF2] dark:from-[#252016] dark:via-[#1E1C20] dark:to-[#171B24] border-[#EDD59E]/55 dark:border-[#EDD59E]/25',
    iconBox: 'bg-[#EDD59E]/45 dark:bg-[#EDD59E]/20 border-[#EDD59E]/60 dark:border-[#EDD59E]/30',
    iconText: 'text-[#7A5714] dark:text-[#EDD59E]',
  },
};

interface ModuleTile {
  id: string;
  route: AppRoute;
  title: string;
  subtitle: string;
  meta: string;
  tone: PastelTone;
  icon: React.ComponentType<{ className?: string }>;
}

export const ExploreHubView: React.FC<ExploreHubViewProps> = ({ counts, onNavigate }) => {
  const [exportStatus, setExportStatus] = useState('');

  const modules: ModuleTile[] = [
    {
      id: 'notes',
      route: 'notes',
      title: 'Personal Notes',
      subtitle: 'Everyday thoughts, clickable links, checklists, and pinned reminders.',
      meta: `${counts.notes} notes · Offline`,
      tone: 'sky',
      icon: FileText,
    },
    {
      id: 'vault',
      route: 'vault',
      title: 'Secrets & Passwords Vault',
      subtitle: 'AES-256 encrypted logins, bank cards, PINs, and custom fields.',
      meta: `${counts.vault} encrypted · Auto-locks`,
      tone: 'lavender',
      icon: Lock,
    },
    {
      id: 'quotes',
      route: 'quotes',
      title: 'Motivational Quotes',
      subtitle: 'Save calming passages and shuffle anytime by mood or purpose.',
      meta: `${counts.quotes} quotes · Mood shuffle`,
      tone: 'rose',
      icon: Quote,
    },
    {
      id: 'tasks',
      route: 'tasks',
      title: 'Tasks & Smart Reminders',
      subtitle: 'Priority tasks, recurring habits, and one-tap Alarm linking.',
      meta: `${counts.tasks} items · Alarm bridge`,
      tone: 'sage',
      icon: CheckSquare,
    },
    {
      id: 'birthdays',
      route: 'birthdays',
      title: 'Birthday Tracker & Wishes',
      subtitle: 'Countdowns, custom wishes to copy, and early notification offsets.',
      meta: `${counts.birthdays} people tracked`,
      tone: 'peach',
      icon: Cake,
    },
    {
      id: 'gallery',
      route: 'gallery',
      title: 'Private Media Gallery',
      subtitle: 'Fingerprint/PIN-locked folders stored privately inside your app.',
      meta: `${counts.media} private files`,
      tone: 'sky',
      icon: ImageIcon,
    },
    {
      id: 'calendar',
      route: 'calendar',
      title: 'General Calendar',
      subtitle: 'Monthly plans, birthdays, reminders, and .ICS / Google Calendar export.',
      meta: `${counts.calendar} events · Local first`,
      tone: 'lavender',
      icon: Calendar,
    },
    {
      id: 'alarms',
      route: 'alarms',
      title: 'Dedicated Alarms',
      subtitle: 'Wake-up, medicine, and reminder-linked alarms with gentle chimes.',
      meta: `${counts.alarms} alarms`,
      tone: 'peach',
      icon: AlarmClock,
    },
    {
      id: 'ideas',
      route: 'ideas',
      title: 'Creative Ideas Hub',
      subtitle: 'Color-coded sticky cards, moodboards, and connected idea boards.',
      meta: `${counts.ideas} cards · Visual boards`,
      tone: 'honey',
      icon: Lightbulb,
    },
    {
      id: 'event-calm',
      route: 'event-calm',
      title: 'Event Calm Mode',
      subtitle: 'Social anxiety companion with check-ins, breathing, and Maps directions.',
      meta: `${counts.events} sessions · Grounding`,
      tone: 'sage',
      icon: Wind,
    },
    {
      id: 'soundscapes',
      route: 'soundscapes',
      title: 'Soundscapes',
      subtitle: 'Looping rain, misty forest, ocean waves, and warm noise synthesized locally.',
      meta:
        counts.activeSoundscapes > 0
          ? `${counts.activeSoundscapes} playing · Web Audio`
          : '6 ambient layers · Offline',
      tone: 'sky',
      icon: AudioLines,
    },
    {
      id: 'analytics',
      route: 'analytics',
      title: 'Analytics & Wellbeing',
      subtitle: 'Charts for daily tasks completed, notes written, and Event Calm Mode time.',
      meta: 'Trends · Charts',
      tone: 'honey',
      icon: BarChart3,
    },
    {
      id: 'maps',
      route: 'maps',
      title: 'Sanctuary Maps',
      subtitle: 'Search venues, preview calm routes, and send destinations to Event Calm Mode.',
      meta: 'Places · Routes',
      tone: 'sage',
      icon: MapPin,
    },
    {
      id: 'game',
      route: 'game',
      title: 'Stillwater Lanterns',
      subtitle: 'Soothing nocturnal pond game—collect drifting lanterns and build flow.',
      meta: 'Zen Arcade · 60fps',
      tone: 'lavender',
      icon: Gamepad2,
    },
    {
      id: 'ai-chat',
      route: 'ai-chat',
      title: 'Gemini Companion',
      subtitle: 'Multi-turn thoughtful chat with tone presets and one-tap saving to Notes.',
      meta: 'Multi-turn · Streaming',
      tone: 'rose',
      icon: MessageSquareHeart,
    },
    {
      id: 'voice-live',
      route: 'voice-live',
      title: 'Live Voice Sanctuary',
      subtitle: 'Real-time bidirectional voice conversations with live transcripts.',
      meta: 'Live Voice · 24kHz',
      tone: 'sage',
      icon: PhoneCall,
    },
    {
      id: 'transcribe',
      route: 'transcribe',
      title: 'Audio Transcription',
      subtitle: 'Record voice memos or upload audio files to convert speech into Notes.',
      meta: 'Speech-to-Text',
      tone: 'peach',
      icon: Mic,
    },
  ];

  const handleExportBackup = async () => {
    try {
      const json = await exportLocalBackupJson();
      const filename = `my-world-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const res = await exportToDevicePublicStorage({
        filename,
        mimeType: 'application/json',
        folderType: 'backup',
        textContent: json,
      });
      if (res.ok) {
        setExportStatus(
          `Local backup saved to ${res.displayPath} (Vault remains AES-256 encrypted).`
        );
      } else {
        setExportStatus(res.error || 'Could not export backup.');
      }
    } catch {
      setExportStatus('Could not export backup.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6]">
            Explore Your World
          </h1>
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] mt-1">
            Everything stays strictly offline inside your device’s private storage.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportBackup}
          className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#ECF7F0] to-[#F7FBFE] dark:from-[#17231F] dark:to-[#171E28] hover:opacity-90 border border-[#9EC5AB]/45 dark:border-[#9EC5AB]/25 text-xs font-semibold text-[#245A3B] dark:text-[#9EC5AB] flex items-center justify-center gap-2 transition-opacity whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Export Local Backup
        </button>
      </header>

      {exportStatus && (
        <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]" role="status">
          {exportStatus}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const style = PASTEL_STYLES[mod.tone];
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onNavigate(mod.route)}
              className={`group text-left border rounded-3xl p-5 sm:p-6 transition-all active:scale-[0.99] flex flex-col justify-between min-h-[150px] shadow-xs ${style.card}`}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${style.iconBox}`}
                  >
                    <Icon className={`w-5 h-5 ${style.iconText}`} />
                  </div>
                  <span className="text-xs font-medium text-[#5B6472] dark:text-[#98A2B3] tabular-nums">
                    {mod.meta}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  {mod.title}
                </h2>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1.5 leading-relaxed">
                  {mod.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-[#EAF7EF] via-[#F6FCF8] to-[#FFFFFF] dark:bg-none dark:bg-[#1E2B26] border border-[#7EB691]/50 dark:border-[#9EC5AB]/45 p-5 sm:p-6 flex items-start gap-4 shadow-[0_6px_24px_-6px_rgba(46,107,72,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_8px_24px_-8px_rgba(158,197,171,0.18)]">
        <div className="w-10 h-10 rounded-2xl bg-[#9EC5AB]/35 dark:bg-[#2A3D35] border border-[#7EB691]/50 dark:border-[#9EC5AB]/45 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-[#225839] dark:text-[#B5DEC4]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            100% Local-First Privacy
          </h3>
          <p className="text-xs text-[#334155] dark:text-[#CBD5E1] mt-1 leading-relaxed">
            Notes, Tasks, Birthdays, Calendar, Private Media, and AES-256 encrypted Vault entries
            live exclusively inside your device storage.
          </p>
        </div>
      </section>
    </div>
  );
};
